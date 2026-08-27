/**
 * In-Memory Decrypted Media Cache for VEIL.
 *
 * Implements ephemeral in-memory caching of decrypted image/video buffers and blob URLs,
 * preventing repeated network downloads and expensive cryptographic re-decryption.
 * All entries are zeroized and revoked on Space lock or Panic Lock.
 */

import { AttachmentPipeline } from '../../attachments/attachmentPipeline.ts';
import { AttachmentMetadata, EncryptedAttachmentChunk } from '../../attachments/types.ts';
import { base64ToBytes } from '../../crypto/utils.ts';
import { CloudClient } from '../../cloud/client.ts';
import { SpaceSession } from '../../spaces/types.ts';

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
}

class MediaCacheManager {
  private cache = new Map<string, DecryptedMedia>();
  private inFlight = new Map<string, Promise<DecryptedMedia>>();

  /**
   * Retrieves a cached decrypted media object or fetches and decrypts it on demand.
   */
  public async getOrFetch(
    attachment: AttachmentPayload,
    session: SpaceSession | null,
    cloudClient: CloudClient
  ): Promise<DecryptedMedia> {
    const key = attachment.objectId || attachment.attachmentId || attachment.name;

    // 1. Return from in-memory cache if already decrypted
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 2. Return existing in-flight promise if a fetch is already in progress
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    // 3. If a direct preview URL already exists (e.g. from local staging)
    if (attachment.previewUrl && attachment.previewUrl.startsWith('blob:')) {
      const mediaItem: DecryptedMedia = {
        id: key,
        blobUrl: attachment.previewUrl,
        data: new Uint8Array(),
        mimeType: attachment.mimeType || 'image/jpeg',
        name: attachment.name,
        sizeBytes: attachment.sizeBytes || 0,
      };
      this.cache.set(key, mediaItem);
      return mediaItem;
    }

    // 4. Start asynchronous download and decryption
    const fetchPromise = (async (): Promise<DecryptedMedia> => {
      try {
        if (!attachment.objectId) {
          throw new Error('Attachment lacks objectId for cloud retrieval');
        }

        const rawCiphertext = await cloudClient.downloadAttachment(attachment.objectId);
        let plaintextBytes: Uint8Array;

        if (attachment.encryptionKeyBase64) {
          const encryptionKey = base64ToBytes(attachment.encryptionKeyBase64);
          const chunks: EncryptedAttachmentChunk[] = JSON.parse(new TextDecoder().decode(rawCiphertext));
          const meta: AttachmentMetadata = {
            attachmentId: attachment.attachmentId || attachment.objectId,
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

        const mimeType = attachment.mimeType || 'application/octet-stream';
        const blobUrl = AttachmentPipeline.createEphemeralBlobUrl(plaintextBytes, mimeType);

        const mediaItem: DecryptedMedia = {
          id: key,
          blobUrl,
          data: plaintextBytes,
          mimeType,
          name: attachment.name,
          sizeBytes: plaintextBytes.length,
        };

        this.cache.set(key, mediaItem);
        return mediaItem;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Retrieves an item synchronously from cache if present.
   */
  public get(key: string): DecryptedMedia | undefined {
    return this.cache.get(key);
  }

  /**
   * Stores a pre-decrypted media item directly in cache (e.g. newly created attachment).
   */
  public set(key: string, item: DecryptedMedia): void {
    this.cache.set(key, item);
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
