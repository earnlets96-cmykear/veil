import { bytesToHex } from '../../crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

interface CipherCacheRecord {
  key: string;
  spaceId: string;
  objectId: string;
  ciphertext: Uint8Array;
  ciphertextHash: string;
  cachedAt: number;
}

const DATABASE = 'veil_media_cipher_cache';
const STORE = 'ciphertext';

export class MediaCipherCacheManager {
  private database: Promise<IDBDatabase | null> | null = null;
  private readonly legacyCleanup: Promise<void>;

  constructor() {
    this.legacyCleanup = this.deleteLegacyPlaintextCache();
  }

  async deleteLegacyPlaintextCache(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    await new Promise<void>((resolve) => {
      try {
        const request = indexedDB.deleteDatabase('veil_media_cache');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      } catch (_error) {
        resolve();
      }
    });
  }

  private open(): Promise<IDBDatabase | null> {
    if (this.database) return this.database;
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);

    this.database = this.legacyCleanup.then(() => new Promise((resolve) => {
      try {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE)) {
            request.result.createObjectStore(STORE, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch (_error) {
        resolve(null);
      }
    }));
    return this.database;
  }

  private cacheKey(spaceId: string, objectId: string): string {
    return JSON.stringify([spaceId, objectId]);
  }

  async get(spaceId: string, objectId: string, expectedHash: string): Promise<Uint8Array | null> {
    if (!expectedHash) return null;
    const db = await this.open();
    if (!db) return null;

    const record = await new Promise<CipherCacheRecord | null>((resolve) => {
      try {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(this.cacheKey(spaceId, objectId));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (_error) {
        resolve(null);
      }
    });
    if (!record || record.spaceId !== spaceId || record.objectId !== objectId) return null;

    const ciphertext = record.ciphertext instanceof Uint8Array ? record.ciphertext : new Uint8Array(record.ciphertext);
    const actualHash = bytesToHex(sha256(ciphertext));
    if (record.ciphertextHash !== expectedHash || actualHash !== expectedHash) {
      await this.delete(spaceId, objectId);
      return null;
    }
    return ciphertext;
  }

  async put(spaceId: string, objectId: string, ciphertext: Uint8Array, expectedHash: string): Promise<void> {
    if (!expectedHash || bytesToHex(sha256(ciphertext)) !== expectedHash) {
      throw new Error('Refusing to cache media with an invalid ciphertext hash');
    }
    const db = await this.open();
    if (!db) throw new Error('Encrypted media cache is unavailable');
    const record: CipherCacheRecord = {
      key: this.cacheKey(spaceId, objectId),
      spaceId,
      objectId,
      ciphertext: ciphertext.slice(),
      ciphertextHash: expectedHash,
      cachedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE, 'readwrite');
        transaction.objectStore(STORE).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Encrypted media cache write failed'));
        transaction.onabort = () => reject(transaction.error || new Error('Encrypted media cache write was aborted'));
      } catch (_error) {
        reject(_error);
      }
    });
  }

  async delete(spaceId: string, objectId: string): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction(STORE, 'readwrite');
        transaction.objectStore(STORE).delete(this.cacheKey(spaceId, objectId));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      } catch (_error) {
        resolve();
      }
    });
  }
}

export const MediaCipherCache = new MediaCipherCacheManager();
