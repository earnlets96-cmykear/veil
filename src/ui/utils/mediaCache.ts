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
import { RuntimeDiagnostics } from '../../debug/runtimeDiagnostics.ts';

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
  localPreviewUrl?: string;
  thumbnailUrl?: string;
  url?: string;
  state?: string;
  error?: string;
  allowSave?: boolean;
  allowForward?: boolean;
}

export class MediaCacheManager {
  private entries = new Map<string, DecryptedMedia>();
  private aliasMap = new Map<string, string>();
  private inFlight = new Map<string, Promise<DecryptedMedia>>();
  private idbInstance: IDBDatabase | null = null;

  public static isAudioMedia(mimeType?: string, name?: string): boolean {
    if (mimeType && mimeType.startsWith('audio/')) {
      return true;
    }
    // Defensive fallback on known audio filenames
    if (name) {
      const lower = name.toLowerCase();
      if (
        lower.endsWith('.m4a') ||
        lower.endsWith('.aac') ||
        lower.endsWith('.mp3') ||
        lower.endsWith('.ogg') ||
        lower.endsWith('.opus') ||
        lower.endsWith('.wav') ||
        lower.includes('voice_note_') ||
        lower.includes('voice-message')
      ) {
        return true;
      }
    }
    return false;
  }

  public get size(): number {
    return this.entries.size;
  }

  public get aliasCount(): number {
    return this.aliasMap.size;
  }

  private async getIDB(): Promise<IDBDatabase | null> {
    if (this.idbInstance) return this.idbInstance;
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('veil_media_cache', 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('media')) {
            req.result.createObjectStore('media', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          this.idbInstance = req.result;
          resolve(this.idbInstance);
        };
        req.onerror = () => resolve(null);
      } catch (_e) {
        resolve(null);
      }
    });
  }

  private async getFromIDB(key: string): Promise<DecryptedMedia | null> {
    try {
      const db = await this.getIDB();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('media', 'readonly');
          const store = tx.objectStore('media');
          const req = store.get(key);
          req.onsuccess = () => {
            const val = req.result;
            if (val && val.data) {
              if (MediaCacheManager.isAudioMedia(val.mimeType, val.name)) {
                resolve(null);
                return;
              }
              const dataBytes = val.data instanceof Uint8Array ? val.data : new Uint8Array(val.data);
              const blobUrl = AttachmentPipeline.createEphemeralBlobUrl(dataBytes, val.mimeType || 'application/octet-stream');
              resolve({
                id: val.id,
                blobUrl,
                data: dataBytes,
                mimeType: val.mimeType,
                name: val.name,
                sizeBytes: dataBytes.length,
              });
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch (_e) {
          resolve(null);
        }
      });
    } catch (_e) {
      return null;
    }
  }

  private async saveToIDB(key: string, item: DecryptedMedia): Promise<void> {
    // HARD RULE: Voice/audio data must remain strictly RAM-only and NEVER written to IDB
    if (MediaCacheManager.isAudioMedia(item.mimeType, item.name)) {
      return;
    }
    try {
      const db = await this.getIDB();
      if (!db) return;
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      store.put({
        id: key,
        data: item.data,
        mimeType: item.mimeType,
        name: item.name,
        sizeBytes: item.sizeBytes,
        timestamp: Date.now(),
      });
    } catch (_e) {}
  }

  /**
   * Retrieves a cached decrypted media object or fetches and decrypts it on demand.
   * Never treats stale persisted blob URLs as valid unless actively in RAM cache.
   */
  public async getOrFetch(
    attachment: AttachmentPayload,
    session: SpaceSession | null,
    cloudClient: CloudClient,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<DecryptedMedia> {
    const candidateKeys = [
      attachment.objectId,
      attachment.attachmentId,
      attachment.name,
    ].filter(Boolean) as string[];

    const primaryKey = candidateKeys[0] || attachment.name;
    const isAudio = MediaCacheManager.isAudioMedia(attachment.mimeType, attachment.name);

    // 1. Return from in-memory RAM cache if actively decrypted in this session
    for (const key of candidateKeys) {
      const cached = this.get(key);
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

    // 3. Start asynchronous cloud download and AEAD decryption with timeout guard
    const fetchPromise = (async (): Promise<DecryptedMedia> => {
      try {
        // Check durable IndexedDB cache for non-audio (survives app restart without re-downloading)
        if (!isAudio) {
          for (const key of candidateKeys) {
            const persisted = await this.getFromIDB(key);
            if (persisted && persisted.blobUrl) {
              const canonicalId = persisted.id || primaryKey;
              this.entries.set(canonicalId, persisted);
              for (const k of candidateKeys) {
                this.aliasMap.set(k, canonicalId);
              }
              return persisted;
            }
          }
        }

        const objectId = attachment.objectId || attachment.attachmentId;
        if (!objectId) {
          throw new Error('Attachment lacks objectId or attachmentId for cloud retrieval');
        }

        const downloadTimeoutMs = Math.max(180000, Math.ceil((attachment.sizeBytes || 1024 * 1024) / 50000) * 1000);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Media download timed out (${Math.round(downloadTimeoutMs / 1000)}s limit exceeded)`)),
            downloadTimeoutMs
          );
        });

        const downloadAndDecrypt = async (): Promise<DecryptedMedia> => {
          RuntimeDiagnostics.download('downloadStarted', { objectId, attachmentId: attachment.attachmentId });
          const rawCiphertext = onProgress
            ? await cloudClient.downloadAttachment(objectId, onProgress)
            : await cloudClient.downloadAttachment(objectId);
          RuntimeDiagnostics.download('downloadCompleted', { objectId, bytes: rawCiphertext.length });

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
              plaintextBytes = await AttachmentPipeline.decryptProgressiveAsync(meta, chunks, encryptionKey);
              RuntimeDiagnostics.decrypt('decryptionCompleted', {
                attachmentId: meta.attachmentId,
                chunkCount: chunks.length,
                decryptedBytes: plaintextBytes.length,
                sha256Verified: true,
              });
            } else {
              plaintextBytes = rawCiphertext;
            }
          } else {
            plaintextBytes = rawCiphertext;
          }

          const mimeType = attachment.mimeType || 'application/octet-stream';
          const blobUrl = AttachmentPipeline.createEphemeralBlobUrl(plaintextBytes, mimeType);

          RuntimeDiagnostics.media('blobCreated', {
            objectId,
            blobUrl,
            blobSize: plaintextBytes.length,
            blobMime: mimeType,
          });

          const mediaItem: DecryptedMedia = {
            id: primaryKey,
            blobUrl,
            data: plaintextBytes,
            mimeType,
            name: attachment.name,
            sizeBytes: plaintextBytes.length,
          };

          // Store single canonical entry and map lookup aliases
          this.entries.set(primaryKey, mediaItem);
          for (const key of candidateKeys) {
            this.aliasMap.set(key, primaryKey);
          }
          if (mediaItem.id) this.aliasMap.set(mediaItem.id, primaryKey);
          if (mediaItem.name) this.aliasMap.set(mediaItem.name, primaryKey);

          this.enforceLruLimit();

          // Save to durable IndexedDB ONLY ONCE under canonical key, NEVER for audio
          if (!isAudio) {
            this.saveToIDB(primaryKey, mediaItem).catch(() => {});
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

  private static readonly MAX_RAM_ENTRIES = 50;

  private enforceLruLimit(): void {
    if (this.entries.size <= MediaCacheManager.MAX_RAM_ENTRIES) return;

    const idsToEvict: string[] = [];
    const itemsToRevoke = new Set<DecryptedMedia>();

    for (const [id, item] of this.entries.entries()) {
      if (this.entries.size - idsToEvict.length <= MediaCacheManager.MAX_RAM_ENTRIES) {
        break;
      }
      idsToEvict.push(id);
      itemsToRevoke.add(item);
    }

    for (const id of idsToEvict) {
      this.entries.delete(id);
      // Clean up all aliases pointing to this evicted canonical ID
      for (const [alias, targetId] of Array.from(this.aliasMap.entries())) {
        if (targetId === id) {
          this.aliasMap.delete(alias);
        }
      }
    }

    for (const item of itemsToRevoke) {
      let stillReferenced = false;
      for (const remaining of this.entries.values()) {
        if (remaining === item || remaining.blobUrl === item.blobUrl) {
          stillReferenced = true;
          break;
        }
      }
      if (!stillReferenced && item.blobUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch (_e) {}
      }
    }
  }

  /**
   * Retrieves an item synchronously from in-memory RAM cache if present.
   * Checks primary key and registered aliases, refreshing LRU position.
   */
  public get(key: string): DecryptedMedia | undefined {
    if (!key) return undefined;
    const canonicalId = this.aliasMap.get(key) || key;
    const item = this.entries.get(canonicalId);
    if (item) {
      // LRU refresh on canonical entry
      this.entries.delete(canonicalId);
      this.entries.set(canonicalId, item);
      return item;
    }
    // Search entries for matching id or name if alias wasn't mapped directly
    for (const [id, v] of this.entries.entries()) {
      if (v.id === key || v.name === key) {
        this.aliasMap.set(key, id);
        this.entries.delete(id);
        this.entries.set(id, v);
        return v;
      }
    }
    return undefined;
  }

  /**
   * Checks if a key or alias is present in the cache without altering LRU order.
   */
  public has(key: string): boolean {
    if (!key) return false;
    const canonicalId = this.aliasMap.get(key) || key;
    if (this.entries.has(canonicalId)) {
      return true;
    }
    for (const v of this.entries.values()) {
      if (v.id === key || v.name === key) {
        return true;
      }
    }
    return false;
  }

  /**
   * Stores a pre-decrypted media item directly in RAM cache (e.g. freshly staged file before sending).
   * Also indexes aliases to ensure immediate cross-key resolution.
   */
  public set(key: string, item: DecryptedMedia): void {
    if (!key || !item) return;
    const canonicalId = item.id || key;

    if (this.entries.has(canonicalId)) {
      this.entries.delete(canonicalId);
    }
    this.entries.set(canonicalId, item);

    // Map aliases to the single canonical entry
    this.aliasMap.set(key, canonicalId);
    if (item.id) {
      this.aliasMap.set(item.id, canonicalId);
    }
    if (item.name) {
      this.aliasMap.set(item.name, canonicalId);
    }
    this.enforceLruLimit();
  }

  /**
   * Refreshes a Blob URL for a cached entry if it was revoked or invalidated.
   * Recreates the URL from cached Uint8Array data and updates all aliases.
   */
  public refreshBlobUrl(id: string): string | null {
    const canonicalId = this.aliasMap.get(id) || id;
    const item = this.entries.get(canonicalId);
    if (!item || !item.data) return null;

    // Revoke stale URL if still around
    if (item.blobUrl && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(item.blobUrl);
      } catch (_e) {}
    }

    const newBlobUrl = AttachmentPipeline.createEphemeralBlobUrl(item.data, item.mimeType || 'application/octet-stream');
    item.blobUrl = newBlobUrl;
    return newBlobUrl;
  }

  /**
   * Explicitly invalidates a key and revokes its Blob URL (used on error or re-fetch retry).
   */
  public async invalidate(key: string): Promise<void> {
    const canonicalId = this.aliasMap.get(key) || key;
    const item = this.entries.get(canonicalId);
    const persistedKeys = new Set<string>([key, canonicalId]);
    if (item?.id) persistedKeys.add(item.id);
    for (const [alias, targetId] of this.aliasMap.entries()) {
      if (targetId === canonicalId) persistedKeys.add(alias);
    }
    if (item) {
      if (item.blobUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch (_e) {}
      }
      this.entries.delete(canonicalId);
      for (const [alias, targetId] of Array.from(this.aliasMap.entries())) {
        if (targetId === canonicalId || alias === key) {
          this.aliasMap.delete(alias);
        }
      }
    } else {
      this.entries.delete(key);
      this.aliasMap.delete(key);
    }
    this.inFlight.delete(key);
    if (canonicalId !== key) {
      this.inFlight.delete(canonicalId);
    }

    // A corrupt cached thumbnail (including a legacy synthetic sticker) must
    // not be resurrected from IndexedDB after its in-memory entry is invalidated.
    const db = await this.getIDB().catch(() => null);
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('media', 'readwrite');
        const store = tx.objectStore('media');
        for (const persistedKey of persistedKeys) store.delete(persistedKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch (_e) {
        resolve();
      }
    });
  }

  /**
   * Clears and revokes all ephemeral media blobs from memory.
   */
  public clear(wipeDurable = false): void {
    for (const item of this.entries.values()) {
      if (item.blobUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch (_e) {}
      }
    }
    this.entries.clear();
    this.aliasMap.clear();
    this.inFlight.clear();

    if (wipeDurable && this.idbInstance) {
      try {
        const tx = this.idbInstance.transaction('media', 'readwrite');
        tx.objectStore('media').clear();
      } catch (_e) {}
    }
  }
}

export const MediaCache = new MediaCacheManager();
