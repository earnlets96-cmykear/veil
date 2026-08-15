/**
 * Encrypted Partitioned Storage for VEIL Spaces.
 *
 * Encrypts all local records with the active Space's StorageKey (derived via HKDF).
 * Supports optional persistent backing via IStorageAdapter (e.g. IndexedDBStorageAdapter).
 *
 * SECURITY INVARIANTS:
 * - Plaintext persistence protection: records written to persistent storage are ALWAYS authenticated AEAD ciphertext.
 * - Locked-Space isolation: accessing records without an active SpaceSession throws immediately.
 * - Zero plaintext leakage to disk or storage backends.
 */

import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { IStorageAdapter, StoredRecord } from './types.ts';

export interface EncryptedRecord {
  key: string;
  nonce: string;       // 24-byte Base64 nonce
  ciphertext: string;  // Base64 encrypted payload + Poly1305 tag
  updatedAt: number;
}

export class EncryptedSpaceStore {
  // Underlying in-memory partition store: Map<spaceId, Map<key, EncryptedRecord>>
  private partitions = new Map<string, Map<string, EncryptedRecord>>();
  private adapter?: IStorageAdapter;

  constructor(adapter?: IStorageAdapter) {
    this.adapter = adapter;
  }

  /**
   * Returns the backing persistent storage adapter if configured.
   */
  public getAdapter(): IStorageAdapter | undefined {
    return this.adapter;
  }

  /**
   * Sets or updates the backing persistent storage adapter.
   */
  public setAdapter(adapter: IStorageAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Encrypts and writes a record to the active Space partition.
   *
   * @param session The active unlocked SpaceSession
   * @param key The record key (e.g. 'contacts', 'chats', 'settings')
   * @param value The value to encrypt and store (string, Uint8Array, or object)
   */
  public set(session: SpaceSession, key: string, value: unknown): void {
    const record = this.encryptAndCache(session, key, value);

    // If a persistent adapter is present, schedule write
    if (this.adapter && this.adapter.isInitialized()) {
      this.adapter.saveRecord(session.spaceId, {
        spaceId: session.spaceId,
        key: record.key,
        nonce: record.nonce,
        ciphertext: record.ciphertext,
        updatedAt: record.updatedAt,
      }).catch((err) => {
        console.error(`[EncryptedSpaceStore] Background persistence error for key ${key}:`, err);
      });
    }
  }

  /**
   * Asynchronously encrypts, writes, and awaits persistence to the backing adapter.
   */
  public async setAsync(session: SpaceSession, key: string, value: unknown): Promise<void> {
    const record = this.encryptAndCache(session, key, value);

    if (this.adapter) {
      if (!this.adapter.isInitialized()) {
        await this.adapter.init();
      }
      await this.adapter.saveRecord(session.spaceId, {
        spaceId: session.spaceId,
        key: record.key,
        nonce: record.nonce,
        ciphertext: record.ciphertext,
        updatedAt: record.updatedAt,
      });
    }
  }

  /**
   * Reads and decrypts a record from the active Space partition.
   *
   * @param session The active unlocked SpaceSession
   * @param key The record key
   * @returns Decrypted value parsed as T or null if not found
   */
  public get<T = unknown>(session: SpaceSession, key: string): T | null {
    this.assertSession(session);

    const spaceId = session.spaceId;
    const partition = this.partitions.get(spaceId);
    if (!partition) return null;

    const record = partition.get(key);
    if (!record) return null;

    return this.decryptRecord<T>(session, record);
  }

  /**
   * Asynchronously reads and decrypts a record, checking memory first, then persistent adapter.
   */
  public async getAsync<T = unknown>(session: SpaceSession, key: string): Promise<T | null> {
    this.assertSession(session);

    // 1. Check in-memory partition cache first
    const cached = this.get<T>(session, key);
    if (cached !== null) return cached;

    // 2. Query persistent adapter if available
    if (this.adapter) {
      if (!this.adapter.isInitialized()) {
        await this.adapter.init();
      }
      const stored = await this.adapter.getRecord(session.spaceId, key);
      if (!stored) return null;

      // Cache locally
      let partition = this.partitions.get(session.spaceId);
      if (!partition) {
        partition = new Map();
        this.partitions.set(session.spaceId, partition);
      }
      const encRecord: EncryptedRecord = {
        key: stored.key,
        nonce: stored.nonce,
        ciphertext: stored.ciphertext,
        updatedAt: stored.updatedAt,
      };
      partition.set(key, encRecord);

      return this.decryptRecord<T>(session, encRecord);
    }

    return null;
  }

  /**
   * Deletes a record from the active Space partition.
   */
  public delete(session: SpaceSession, key: string): boolean {
    this.assertSession(session);

    const partition = this.partitions.get(session.spaceId);
    const existed = partition ? partition.delete(key) : false;

    if (this.adapter && this.adapter.isInitialized()) {
      this.adapter.deleteRecord(session.spaceId, key).catch(() => {});
    }

    return existed;
  }

  /**
   * Asynchronously deletes a record and awaits confirmation from the backing adapter.
   */
  public async deleteAsync(session: SpaceSession, key: string): Promise<boolean> {
    this.assertSession(session);

    const partition = this.partitions.get(session.spaceId);
    const existed = partition ? partition.delete(key) : false;

    if (this.adapter) {
      if (!this.adapter.isInitialized()) {
        await this.adapter.init();
      }
      const deletedFromAdapter = await this.adapter.deleteRecord(session.spaceId, key);
      return existed || deletedFromAdapter;
    }

    return existed;
  }

  /**
   * Returns all keys stored in the active Space partition.
   */
  public listKeys(session: SpaceSession): string[] {
    this.assertSession(session);

    const partition = this.partitions.get(session.spaceId);
    if (!partition) return [];
    return Array.from(partition.keys());
  }

  /**
   * Asynchronously loads all persisted records for an active Space from the backing storage adapter.
   *
   * @param session The active unlocked SpaceSession
   * @returns Number of loaded records
   */
  public async loadPartitionFromStorage(session: SpaceSession): Promise<number> {
    this.assertSession(session);
    if (!this.adapter) return 0;

    if (!this.adapter.isInitialized()) {
      await this.adapter.init();
    }

    const storedRecords = await this.adapter.listRecords(session.spaceId);
    let partition = this.partitions.get(session.spaceId);
    if (!partition) {
      partition = new Map();
      this.partitions.set(session.spaceId, partition);
    }

    for (const record of storedRecords) {
      partition.set(record.key, {
        key: record.key,
        nonce: record.nonce,
        ciphertext: record.ciphertext,
        updatedAt: record.updatedAt,
      });
    }

    return storedRecords.length;
  }

  /**
   * Direct low-level access to raw ciphertext records for testing cross-space attacks.
   */
  public getRawPartition(spaceId: string): Map<string, EncryptedRecord> | undefined {
    return this.partitions.get(spaceId);
  }

  /**
   * Purges a Space's storage partition (used on Space deletion).
   */
  public purgePartition(spaceId: string): void {
    this.partitions.delete(spaceId);
    if (this.adapter && this.adapter.isInitialized()) {
      this.adapter.clearPartition(spaceId).catch(() => {});
    }
  }

  /**
   * Helper: Encrypts a value under Space StorageKey and writes to in-memory partition.
   */
  private encryptAndCache(session: SpaceSession, key: string, value: unknown): EncryptedRecord {
    this.assertSession(session);

    const spaceId = session.spaceId;
    const storageKey = session.getStorageKey();

    const plaintext = typeof value === 'string'
      ? value
      : value instanceof Uint8Array
        ? value
        : JSON.stringify(value);

    const { nonce, ciphertext } = encryptXChaCha20Poly1305(storageKey, plaintext);

    let partition = this.partitions.get(spaceId);
    if (!partition) {
      partition = new Map();
      this.partitions.set(spaceId, partition);
    }

    const record: EncryptedRecord = {
      key,
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
      updatedAt: Date.now(),
    };

    partition.set(key, record);
    return record;
  }

  /**
   * Helper: Decrypts an EncryptedRecord under Space StorageKey.
   */
  private decryptRecord<T>(session: SpaceSession, record: EncryptedRecord): T {
    const storageKey = session.getStorageKey();
    const nonce = base64ToBytes(record.nonce);
    const ciphertext = base64ToBytes(record.ciphertext);

    const decryptedBytes = decryptXChaCha20Poly1305(storageKey, nonce, ciphertext);
    const text = new TextDecoder().decode(decryptedBytes);

    try {
      return JSON.parse(text) as T;
    } catch (_e) {
      return text as unknown as T;
    }
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('Cannot access store: Space session is locked or destroyed');
    }
  }
}
