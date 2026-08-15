/**
 * Encrypted Partitioned Storage for VEIL Spaces.
 * Encrypts all local records with the active Space's StorageKey (derived via HKDF).
 */

import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import type { SpaceSession } from '../spaces/session.ts';

export interface EncryptedRecord {
  key: string;
  nonce: string;       // 24-byte Base64 nonce
  ciphertext: string;  // Base64 encrypted payload + Poly1305 tag
  updatedAt: number;
}

export class EncryptedSpaceStore {
  // Underlying partition store: Map<spaceId, Map<key, EncryptedRecord>>
  private partitions = new Map<string, Map<string, EncryptedRecord>>();

  /**
   * Encrypts and writes a record to the active Space partition.
   *
   * @param session The active unlocked SpaceSession
   * @param key The record key (e.g. 'contacts', 'chats', 'settings')
   * @param value The value to encrypt and store (string, Uint8Array, or object)
   */
  public set(session: SpaceSession, key: string, value: unknown): void {
    if (!session || !session.isActive()) {
      throw new Error('Cannot write to store: Space session is locked or destroyed');
    }

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

    partition.set(key, {
      key,
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
      updatedAt: Date.now(),
    });
  }

  /**
   * Reads and decrypts a record from the active Space partition.
   *
   * @param session The active unlocked SpaceSession
   * @param key The record key
   * @returns Decrypted value parsed as T or null if not found
   */
  public get<T = unknown>(session: SpaceSession, key: string): T | null {
    if (!session || !session.isActive()) {
      throw new Error('Cannot read from store: Space session is locked or destroyed');
    }

    const spaceId = session.spaceId;
    const partition = this.partitions.get(spaceId);
    if (!partition) return null;

    const record = partition.get(key);
    if (!record) return null;

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

  /**
   * Deletes a record from the active Space partition.
   */
  public delete(session: SpaceSession, key: string): boolean {
    if (!session || !session.isActive()) {
      throw new Error('Cannot delete from store: Space session is locked or destroyed');
    }

    const partition = this.partitions.get(session.spaceId);
    if (!partition) return false;
    return partition.delete(key);
  }

  /**
   * Returns all keys stored in the Space partition.
   */
  public listKeys(session: SpaceSession): string[] {
    if (!session || !session.isActive()) {
      throw new Error('Cannot list keys: Space session is locked or destroyed');
    }

    const partition = this.partitions.get(session.spaceId);
    if (!partition) return [];
    return Array.from(partition.keys());
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
  }
}
