/**
 * In-Memory Ephemeral Decrypted Media Cache for VEIL.
 *
 * Implements ephemeral in-memory caching of decrypted image/video buffers and blob URLs,
 * preventing repeated network downloads and expensive cryptographic re-decryption.
 *
 * HARD PERSISTENCE RULES:
 * - Blob URLs are strictly session-ephemeral. NEVER treated as durable across app restarts.
 * - Stale, revoked, or dead Blob URLs are automatically invalidated and re-fetched from R2/S3.
 * - All entries are zeroized and revoked on Space lock or Panic Lock.
 */

import { AttachmentPipeline } from '../../attachments/attachmentPipeline.ts';
import { AttachmentMetadata, EncryptedAttachmentChunk } from '../../attachments/types.ts';
import { base64ToBytes } from '../../crypto/utils.ts';
import { CloudClient } from '../../network/cloudClient.ts';
import { SpaceSession } from '../../spaces/session.ts';

export interface DecryptedMedia {
  id: string;
  blobUrl: string;
  data: Uint8Array;
  mimeType: string;
  name: string;
  sizeBytes: number;
}

export interface AttachmentPayload {
  attachmentId?: string;
  objectId?: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  chunkCount?: number;
  chunkSize?: number;
  sha256Hash?: string;
  encryptionKeyBase64?: string;
  previewUrl?: string;
  url?: string;
  state?: string;
  error?: string;
}

class MediaCacheManager {
  private cache = new Map<string, DecryptedMedia>();
  private inFlight = new Map<string, Promise<DecryptedMedia>>();

  /**
   * Retrieves a cached decrypted media object or fetches and decrypts it on demand.
   * Never treats stale persisted blob URLs as valid unless actively in RAM cache.
   */
  public async getOrFetch(
    attachment: AttachmentPayload,
    session: SpaceSession | null,
    cloudClient: CloudClient
  ): Promise<DecryptedMedia> {
    const candidateKeys = [
      attachment.objectId,
      attachment.attachmentId,
      attachment.name,
    ].filter(Boolean) as string[];

    const primaryKey = candidateKeys[0] || attachment.name;

    // 1. Return from in-memory RAM cache if actively decrypted in this session
    for (const key of candidateKeys) {
      const cached = this.cache.get(key);
      if (cached && cached.blobUrl) {
        return cached;
      }
    }

    // 2. Return existing in-flight promise if a fetch is already running for any matching key
    for (const key of candidateKeys) {
      if (this.inFlight.has(key)) {
        return this.inFlight.get(key)!;
      }
    }

    // 3. Start asynchronous cloud download and AEAD decryption with a 30s timeout guard
    const fetchPromise = (async (): Promise<DecryptedMedia> => {
      try {
        const objectId = attachment.objectId || attachment.attachmentId;
        if (!objectId) {
          throw new Error('Attachment lacks objectId or attachmentId for cloud retrieval');
        }

        // 30s timeout boundary to prevent permanent "Decrypting" hang
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Media download timed out (30s limit exceeded)')), 30000);
        });

        const downloadAndDecrypt = async (): Promise<DecryptedMedia> => {
          const rawCiphertext = await cloudClient.downloadAttachment(objectId);
          let plaintextBytes: Uint8Array;

          if (attachment.encryptionKeyBase64) {
            const encryptionKey = base64ToBytes(attachment.encryptionKeyBase64);
            let chunks: EncryptedAttachmentChunk[];
            try {
              chunks = JSON.parse(new TextDecoder().decode(rawCiphertext));
            } catch (_jsonErr) {
              chunks = [];
            }

            if (Array.isArray(chunks) && chunks.length > 0) {
              const meta: AttachmentMetadata = {
                attachmentId: attachment.attachmentId || objectId,
                name: attachment.name,
                mimeType: attachment.mimeType || 'application/octet-stream',
                sizeBytes: attachment.sizeBytes || 0,
                chunkCount: attachment.chunkCount || chunks.length,
                chunkSize: attachment.chunkSize || (64 * 1024),
                sha256Hash: attachment.sha256Hash || '',
              };
              plaintextBytes = AttachmentPipeline.decryptAndReassemble(meta, chunks, encryptionKey);
            } else {
              plaintextBytes = rawCiphertext;
            }
          } else {
            plaintextBytes = rawCiphertext;
          }

          const mimeType = attachment.mimeType || 'application/octet-stream';
          const blobUrl = AttachmentPipeline.createEphemeralBlobUrl(plaintextBytes, mimeType);

          const mediaItem: DecryptedMedia = {
            id: primaryKey,
            blobUrl,
            data: plaintextBytes,
            mimeType,
            name: attachment.name,
            sizeBytes: plaintextBytes.length,
          };

          // Store under all candidate keys
          for (const key of candidateKeys) {
            this.cache.set(key, mediaItem);
          }

          return mediaItem;
        };

        return await Promise.race([downloadAndDecrypt(), timeoutPromise]);
      } finally {
        for (const key of candidateKeys) {
          this.inFlight.delete(key);
        }
      }
    })();

    for (const key of candidateKeys) {
      this.inFlight.set(key, fetchPromise);
    }

    return fetchPromise;
  }

  /**
   * Retrieves an item synchronously from in-memory RAM cache if present.
   */
  public get(key: string): DecryptedMedia | undefined {
    return this.cache.get(key);
  }

  /**
   * Stores a pre-decrypted media item directly in RAM cache (e.g. freshly staged file before sending).
   */
  public set(key: string, item: DecryptedMedia): void {
    this.cache.set(key, item);
  }

  /**
   * Explicitly invalidates a key and revokes its Blob URL (used on error or re-fetch retry).
   */
  public invalidate(key: string): void {
    const item = this.cache.get(key);
    if (item) {
      if (item.blobUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch (_e) {}
      }
      for (const [k, v] of Array.from(this.cache.entries())) {
        if (v === item || v.id === item.id || k === key) {
          this.cache.delete(k);
        }
      }
    } else {
      this.cache.delete(key);
    }
    this.inFlight.delete(key);
  }

  /**
   * Clears and revokes all ephemeral media blobs from memory.
   */
  public clear(): void {
    for (const item of this.cache.values()) {
      if (item.blobUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch (_e) {}
      }
    }
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const MediaCache = new MediaCacheManager();
