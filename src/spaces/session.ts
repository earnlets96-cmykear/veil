/**
 * Active In-Memory Space Session for VEIL.
 * Manages decrypted cryptographic key material during an active Space lifecycle.
 */

import { zeroize } from '../crypto/memory.ts';
import { deriveStorageKey, deriveIdentitySeed } from '../crypto/hkdf.ts';

export class SpaceSession {
  public readonly spaceId: string;
  public readonly name: string;
  public readonly isDecoy: boolean;

  private masterKey: Uint8Array | null;
  private storageKey: Uint8Array | null;
  private identitySeed: Uint8Array | null;
  private active = true;

  constructor(spaceId: string, name: string, isDecoy: boolean, masterKey: Uint8Array) {
    if (masterKey.length !== 32) {
      throw new Error(`Invalid master key length: expected 32 bytes, got ${masterKey.length}`);
    }

    this.spaceId = spaceId;
    this.name = name;
    this.isDecoy = isDecoy;

    // Clone master key into session-scoped buffer
    this.masterKey = new Uint8Array(masterKey);
    this.storageKey = deriveStorageKey(this.masterKey);
    this.identitySeed = deriveIdentitySeed(this.masterKey);
  }

  /**
   * Returns true if the session is active and keys are loaded in volatile memory.
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Returns a reference to the active storage key for database encryption.
   * Throws if the session has been locked or destroyed.
   */
  public getStorageKey(): Uint8Array {
    this.assertActive();
    return this.storageKey!;
  }

  /**
   * Returns a reference to the active identity seed.
   * Throws if the session has been locked or destroyed.
   */
  public getIdentitySeed(): Uint8Array {
    this.assertActive();
    return this.identitySeed!;
  }

  /**
   * Closes the session and wipes all key material from memory.
   */
  public destroy(): void {
    if (this.masterKey) {
      zeroize(this.masterKey);
      this.masterKey = null;
    }
    if (this.storageKey) {
      zeroize(this.storageKey);
      this.storageKey = null;
    }
    if (this.identitySeed) {
      zeroize(this.identitySeed);
      this.identitySeed = null;
    }
    this.active = false;
  }

  private assertActive(): void {
    if (!this.active || !this.masterKey) {
      throw new Error(`Space ${this.spaceId} is locked or destroyed`);
    }
  }
}
