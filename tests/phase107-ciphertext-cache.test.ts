import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import 'fake-indexeddb/auto';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '../src/crypto/utils.ts';
import { MediaCipherCacheManager } from '../src/ui/utils/mediaCipherCache.ts';

describe('media cache persistence boundary', () => {
  it('does not persist decrypted media and reads durable bytes through a ciphertext cache', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/ui/utils/mediaCache.ts'), 'utf8');
    expect(source).not.toContain('saveToIDB');
    expect(source).not.toContain('getFromIDB');
    expect(source).toContain('MediaCipherCache');
    expect(source).toContain('ciphertextHash');
  });

  it('persists ciphertext across cache instances and partitions it by Space', async () => {
    const firstCache = new MediaCipherCacheManager();
    const bytes = new TextEncoder().encode('ciphertext bytes only');
    const hash = bytesToHex(sha256(bytes));
    await firstCache.put('space-a', 'object-1', bytes, hash);

    const afterReentry = new MediaCipherCacheManager();
    expect(await afterReentry.get('space-a', 'object-1', hash)).toEqual(bytes);
    expect(await afterReentry.get('space-b', 'object-1', hash)).toBeNull();

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('veil_media_cipher_cache', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<any[]>((resolve, reject) => {
      const request = db.transaction('ciphertext', 'readonly').objectStore('ciphertext').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(records[0]).toHaveProperty('ciphertext');
    expect(records[0]).not.toHaveProperty('plaintext');
    db.close();
    expect(await afterReentry.get('space-a', 'object-1', 'wrong-hash')).toBeNull();
  });

  it('deletes the legacy database that contained decrypted media', async () => {
    const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('veil_media_cache', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = legacyDb.transaction('media', 'readwrite');
      transaction.objectStore('media').put({ id: 'old-private-image', data: new Uint8Array([1, 2, 3]) });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    legacyDb.close();

    const cache = new MediaCipherCacheManager();
    await cache.deleteLegacyPlaintextCache();
    const databases = await indexedDB.databases();
    expect(databases.some((database) => database.name === 'veil_media_cache')).toBe(false);
  });
});
