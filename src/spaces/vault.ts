/**
 * Space Vault Manager for VEIL.
 * Implements Multi-Space management, credential-selected unlocking,
 * envelope wrapping, and cryptographic isolation.
 */

import { randomBytes, bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import { zeroize, withSecureBuffer } from '../crypto/memory.ts';
import { deriveKeyArgon2id, DEFAULT_KDF_PARAMS } from '../crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { SpaceSession } from './session.ts';
import { validateSpaceEnvelope, CURRENT_ENVELOPE_VERSION } from './envelope.ts';
import type { SpaceHeaderEnvelope, KdfParameters } from '../types/index.ts';

export interface CreateSpaceOptions {
  name: string;
  password: string;
  isDecoy?: boolean;
  kdfParams?: Partial<KdfParameters>;
  spaceId?: string; // Optional custom ID (used for testing or deterministic seeding)
}

export class SpaceVaultManager {
  private envelopes = new Map<string, SpaceHeaderEnvelope>();
  private activeSessions = new Map<string, SpaceSession>();

  /**
   * Registers or loads an existing envelope into the manager.
   */
  public registerEnvelope(envelope: SpaceHeaderEnvelope): void {
    validateSpaceEnvelope(envelope);
    this.envelopes.set(envelope.spaceId, envelope);
  }

  /**
   * Returns a list of all registered Space Header Envelopes.
   */
  public listEnvelopes(): SpaceHeaderEnvelope[] {
    return Array.from(this.envelopes.values());
  }

  /**
   * Returns an envelope by spaceId if present.
   */
  public getEnvelope(spaceId: string): SpaceHeaderEnvelope | undefined {
    return this.envelopes.get(spaceId);
  }

  /**
   * Creates a new Space, generates an independent random Space Master Key (SMK),
   * derives an Argon2id KEK, seals the SMK inside an encrypted envelope, and registers it.
   */
  public createSpace(options: CreateSpaceOptions): SpaceHeaderEnvelope {
    const { name, password, isDecoy = false, kdfParams, spaceId = crypto.randomUUID() } = options;

    if (!password || password.length === 0) {
      throw new Error('Password must not be empty');
    }
    if (!name || name.trim() === '') {
      throw new Error('Space name must not be empty');
    }

    // 1. Generate independent 32-byte salt and 32-byte random Space Master Key (SMK)
    const saltBytes = randomBytes(32);
    const saltBase64 = bytesToBase64(saltBytes);

    const activeKdfParams: KdfParameters = {
      algorithm: 'argon2id',
      salt: saltBase64,
      timeCost: kdfParams?.timeCost ?? DEFAULT_KDF_PARAMS.timeCost,
      memoryCost: kdfParams?.memoryCost ?? DEFAULT_KDF_PARAMS.memoryCost,
      parallelism: kdfParams?.parallelism ?? DEFAULT_KDF_PARAMS.parallelism,
      keyLength: 32,
    };

    // 2. Generate random 256-bit Space Master Key (SMK)
    const smk = randomBytes(32);

    let kek: Uint8Array | null = null;
    try {
      // 3. Derive KEK via Argon2id
      kek = deriveKeyArgon2id(password, saltBytes, activeKdfParams);

      // 4. Encrypt and authenticate SMK with KEK using XChaCha20-Poly1305
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(kek, smk);

      const envelope: SpaceHeaderEnvelope = {
        spaceId,
        version: CURRENT_ENVELOPE_VERSION,
        name,
        isDecoy,
        kdfParams: activeKdfParams,
        encryptedMasterKey: {
          algorithm: 'XChaCha20-Poly1305',
          nonce: bytesToBase64(nonce),
          ciphertext: bytesToBase64(ciphertext),
        },
        createdAt: Date.now(),
      };

      validateSpaceEnvelope(envelope);
      this.envelopes.set(spaceId, envelope);
      return envelope;
    } finally {
      // Clean up temporary keys
      if (kek) zeroize(kek);
      zeroize(smk);
      zeroize(saltBytes);
    }
  }

  /**
   * Unlocks a Space using credential-selected unlocking.
   * Scans candidate envelopes, derives KEK for each salt, attempts AEAD decryption,
   * and loads the matching Space into an active SpaceSession.
   *
   * @throws Generic error on invalid password or missing matching envelope
   */
  public unlockSpace(password: string): SpaceSession {
    if (!password || password.length === 0) {
      throw new Error('Unable to unlock Space: empty password');
    }

    // Try candidate envelopes
    for (const envelope of this.envelopes.values()) {
      let candidateKek: Uint8Array | null = null;
      let decryptedSmk: Uint8Array | null = null;

      try {
        validateSpaceEnvelope(envelope);
        candidateKek = deriveKeyArgon2id(password, envelope.kdfParams.salt, envelope.kdfParams);

        const nonceBytes = base64ToBytes(envelope.encryptedMasterKey.nonce);
        const ciphertextBytes = base64ToBytes(envelope.encryptedMasterKey.ciphertext);

        // Attempt authenticated decryption
        decryptedSmk = decryptXChaCha20Poly1305(candidateKek, nonceBytes, ciphertextBytes);

        // Success: create active session
        const session = new SpaceSession(
          envelope.spaceId,
          envelope.name,
          envelope.isDecoy,
          decryptedSmk
        );

        this.activeSessions.set(envelope.spaceId, session);
        return session;
      } catch (_err) {
        // Mismatch: continue to next candidate envelope
        continue;
      } finally {
        if (candidateKek) zeroize(candidateKek);
        if (decryptedSmk) zeroize(decryptedSmk);
      }
    }

    // Generic safe error
    throw new Error('Unable to unlock Space: invalid credentials or corrupted envelope');
  }

  /**
   * Returns an active in-memory SpaceSession by spaceId if unlocked.
   */
  public getActiveSession(spaceId: string): SpaceSession | undefined {
    const session = this.activeSessions.get(spaceId);
    if (session && session.isActive()) {
      return session;
    }
    return undefined;
  }

  /**
   * Locks an active Space, wipes its keys from memory, and removes the active session.
   */
  public lockSpace(spaceId: string): void {
    const session = this.activeSessions.get(spaceId);
    if (session) {
      session.destroy();
      this.activeSessions.delete(spaceId);
    }
  }

  /**
   * Locks all currently active Spaces and wipes memory.
   */
  public lockAll(): void {
    for (const session of this.activeSessions.values()) {
      session.destroy();
    }
    this.activeSessions.clear();
  }

  /**
   * Changes the password for a Space without re-encrypting underlying database records.
   * Unwraps the existing SMK with oldPassword and re-encrypts under newPassword with a fresh salt.
   */
  public changePassword(
    spaceId: string,
    oldPassword: string,
    newPassword: string,
    newKdfParams?: Partial<KdfParameters>
  ): SpaceHeaderEnvelope {
    const envelope = this.envelopes.get(spaceId);
    if (!envelope) {
      throw new Error(`Space ${spaceId} not found`);
    }

    let oldKek: Uint8Array | null = null;
    let smk: Uint8Array | null = null;
    let newKek: Uint8Array | null = null;
    const newSaltBytes = randomBytes(32);

    try {
      // 1. Recover SMK using old password
      oldKek = deriveKeyArgon2id(oldPassword, envelope.kdfParams.salt, envelope.kdfParams);
      const oldNonce = base64ToBytes(envelope.encryptedMasterKey.nonce);
      const oldCiphertext = base64ToBytes(envelope.encryptedMasterKey.ciphertext);
      smk = decryptXChaCha20Poly1305(oldKek, oldNonce, oldCiphertext);

      // 2. Derive new KEK with fresh salt
      const updatedKdfParams: KdfParameters = {
        algorithm: 'argon2id',
        salt: bytesToBase64(newSaltBytes),
        timeCost: newKdfParams?.timeCost ?? envelope.kdfParams.timeCost,
        memoryCost: newKdfParams?.memoryCost ?? envelope.kdfParams.memoryCost,
        parallelism: newKdfParams?.parallelism ?? envelope.kdfParams.parallelism,
        keyLength: 32,
      };

      newKek = deriveKeyArgon2id(newPassword, newSaltBytes, updatedKdfParams);

      // 3. Re-encrypt existing SMK with new KEK and fresh random nonce
      const { nonce: newNonce, ciphertext: newCiphertext } = encryptXChaCha20Poly1305(newKek, smk);

      const updatedEnvelope: SpaceHeaderEnvelope = {
        ...envelope,
        kdfParams: updatedKdfParams,
        encryptedMasterKey: {
          algorithm: 'XChaCha20-Poly1305',
          nonce: bytesToBase64(newNonce),
          ciphertext: bytesToBase64(newCiphertext),
        },
      };

      validateSpaceEnvelope(updatedEnvelope);
      this.envelopes.set(spaceId, updatedEnvelope);
      return updatedEnvelope;
    } catch (_err) {
      throw new Error('Failed to change password: invalid current credentials');
    } finally {
      if (oldKek) zeroize(oldKek);
      if (smk) zeroize(smk);
      if (newKek) zeroize(newKek);
      zeroize(newSaltBytes);
    }
  }

  /**
   * Deletes a Space and removes its envelope and cryptographic access.
   */
  public deleteSpace(spaceId: string): void {
    this.lockSpace(spaceId);
    this.envelopes.delete(spaceId);
  }

  /**
   * Clears all envelopes and active sessions.
   */
  public reset(): void {
    this.lockAll();
    this.envelopes.clear();
  }
}
