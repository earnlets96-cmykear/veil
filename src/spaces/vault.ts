/**
 * Space Vault Manager for VEIL.
 * Implements Multi-Space management, credential-selected unlocking,
 * authenticated envelope wrapping (with AAD binding), and cryptographic isolation.
 */

import { randomBytes, bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import { deriveKeyArgon2id, deriveKeyArgon2idAsync, DEFAULT_KDF_PARAMS } from '../crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { SpaceSession } from './session.ts';
import { validateSpaceEnvelope, computeEnvelopeAad, CURRENT_ENVELOPE_VERSION } from './envelope.ts';
import type { SpaceHeaderEnvelope, KdfParameters } from '../types/index.ts';

export interface CreateSpaceOptions {
  name: string;
  password: string;
  isDecoy?: boolean;
  kdfParams?: Partial<KdfParameters>;
  spaceId?: string; // Optional custom ID (used for testing or deterministic seeding)
  masterKey?: Uint8Array; // Optional master key (used for recovery/import)
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
   * derives an Argon2id KEK, seals the SMK inside an encrypted envelope with AAD metadata binding,
   * and registers the envelope.
   */
  public createSpace(options: CreateSpaceOptions): SpaceHeaderEnvelope {
    const { name, password, isDecoy = false, kdfParams, spaceId = crypto.randomUUID(), masterKey } = options;

    if (!password || password.length === 0) {
      throw new Error('Password must not be empty');
    }
    if (!name || name.trim() === '') {
      throw new Error('Space name must not be empty');
    }

    // 1. Generate independent 32-byte salt and 32-byte Space Master Key (SMK)
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

    // 2. Use supplied masterKey or generate random 256-bit Space Master Key (SMK)
    const smk = masterKey ? new Uint8Array(masterKey) : randomBytes(32);


    let kek: Uint8Array | null = null;
    try {
      // 3. Derive KEK via Argon2id
      kek = deriveKeyArgon2id(password, saltBytes, activeKdfParams);

      // 4. Compute canonical AAD binding envelope context
      const aad = computeEnvelopeAad(
        spaceId,
        CURRENT_ENVELOPE_VERSION,
        'XChaCha20-Poly1305',
        saltBase64
      );

      // 5. Encrypt and authenticate SMK with KEK using XChaCha20-Poly1305 + AAD
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(kek, smk, aad);

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
   * Unlocks a Space.
   * - If `spaceId` is provided: targeted single-envelope unlock (1 Argon2id derivation).
   * - If `spaceId` is omitted: scans registered candidate envelopes (Phase 1 prototype discovery).
   *
   * @param password The unlock credential
   * @param targetSpaceId Optional spaceId to target specific envelope directly
   * @returns Active unlocked SpaceSession
   * @throws Generic error on invalid password or missing matching envelope
   */
  public unlockSpace(password: string, targetSpaceId?: string): SpaceSession {
    if (!password || password.length === 0) {
      throw new Error('Unable to unlock Space: empty password');
    }

    const candidateEnvelopes = targetSpaceId
      ? (this.envelopes.has(targetSpaceId) ? [this.envelopes.get(targetSpaceId)!] : [])
      : Array.from(this.envelopes.values());

    if (candidateEnvelopes.length === 0) {
      throw new Error('Unable to unlock Space: invalid credentials or corrupted envelope');
    }

    // Try candidate envelopes
    for (const envelope of candidateEnvelopes) {
      let candidateKek: Uint8Array | null = null;
      let decryptedSmk: Uint8Array | null = null;

      try {
        validateSpaceEnvelope(envelope);
        candidateKek = deriveKeyArgon2id(password, envelope.kdfParams.salt, envelope.kdfParams);

        const nonceBytes = base64ToBytes(envelope.encryptedMasterKey.nonce);
        const ciphertextBytes = base64ToBytes(envelope.encryptedMasterKey.ciphertext);

        // Compute canonical AAD to verify context binding
        const aad = computeEnvelopeAad(
          envelope.spaceId,
          envelope.version,
          envelope.encryptedMasterKey.algorithm,
          envelope.kdfParams.salt
        );

        // Attempt authenticated decryption with AAD
        decryptedSmk = decryptXChaCha20Poly1305(candidateKek, nonceBytes, ciphertextBytes, aad);

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
   * Async version of unlockSpace that runs Argon2id in a Web Worker
   * to prevent UI thread blocking. Falls back to synchronous derivation
   * if Workers are unavailable.
   */
  public async unlockSpaceAsync(password: string, targetSpaceId?: string): Promise<SpaceSession> {
    if (!password || password.length === 0) {
      throw new Error('Unable to unlock Space: empty password');
    }

    const candidateEnvelopes = targetSpaceId
      ? (this.envelopes.has(targetSpaceId) ? [this.envelopes.get(targetSpaceId)!] : [])
      : Array.from(this.envelopes.values());

    if (candidateEnvelopes.length === 0) {
      throw new Error('Unable to unlock Space: invalid credentials or corrupted envelope');
    }

    for (const envelope of candidateEnvelopes) {
      let candidateKek: Uint8Array | null = null;
      let decryptedSmk: Uint8Array | null = null;

      try {
        validateSpaceEnvelope(envelope);
        candidateKek = await deriveKeyArgon2idAsync(password, envelope.kdfParams.salt, envelope.kdfParams);

        const nonceBytes = base64ToBytes(envelope.encryptedMasterKey.nonce);
        const ciphertextBytes = base64ToBytes(envelope.encryptedMasterKey.ciphertext);

        const aad = computeEnvelopeAad(
          envelope.spaceId,
          envelope.version,
          envelope.encryptedMasterKey.algorithm,
          envelope.kdfParams.salt
        );

        decryptedSmk = decryptXChaCha20Poly1305(candidateKek, nonceBytes, ciphertextBytes, aad);

        const session = new SpaceSession(
          envelope.spaceId,
          envelope.name,
          envelope.isDecoy,
          decryptedSmk
        );

        this.activeSessions.set(envelope.spaceId, session);
        return session;
      } catch (_err) {
        continue;
      } finally {
        if (candidateKek) zeroize(candidateKek);
        if (decryptedSmk) zeroize(decryptedSmk);
      }
    }

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
   * Transactional, crash-safe password change.
   * Unwraps the existing SMK with oldPassword and re-encrypts under newPassword with fresh salt and AAD.
   * Atomically commits only after full validation. If any error occurs, existing envelope remains untouched.
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
    const newSaltBase64 = bytesToBase64(newSaltBytes);

    try {
      // 1. Recover SMK using old password and old AAD
      oldKek = deriveKeyArgon2id(oldPassword, envelope.kdfParams.salt, envelope.kdfParams);
      const oldNonce = base64ToBytes(envelope.encryptedMasterKey.nonce);
      const oldCiphertext = base64ToBytes(envelope.encryptedMasterKey.ciphertext);
      const oldAad = computeEnvelopeAad(
        envelope.spaceId,
        envelope.version,
        envelope.encryptedMasterKey.algorithm,
        envelope.kdfParams.salt
      );

      smk = decryptXChaCha20Poly1305(oldKek, oldNonce, oldCiphertext, oldAad);

      // 2. Derive new KEK with fresh salt
      const updatedKdfParams: KdfParameters = {
        algorithm: 'argon2id',
        salt: newSaltBase64,
        timeCost: newKdfParams?.timeCost ?? envelope.kdfParams.timeCost,
        memoryCost: newKdfParams?.memoryCost ?? envelope.kdfParams.memoryCost,
        parallelism: newKdfParams?.parallelism ?? envelope.kdfParams.parallelism,
        keyLength: 32,
      };

      newKek = deriveKeyArgon2id(newPassword, newSaltBytes, updatedKdfParams);

      // 3. Compute new canonical AAD
      const newAad = computeEnvelopeAad(
        envelope.spaceId,
        envelope.version,
        'XChaCha20-Poly1305',
        newSaltBase64
      );

      // 4. Re-encrypt existing SMK with new KEK, fresh nonce, and new AAD
      const { nonce: newNonce, ciphertext: newCiphertext } = encryptXChaCha20Poly1305(newKek, smk, newAad);

      const candidateEnvelope: SpaceHeaderEnvelope = {
        ...envelope,
        kdfParams: updatedKdfParams,
        encryptedMasterKey: {
          algorithm: 'XChaCha20-Poly1305',
          nonce: bytesToBase64(newNonce),
          ciphertext: bytesToBase64(newCiphertext),
        },
      };

      // 5. Pre-validate candidate envelope before committing
      validateSpaceEnvelope(candidateEnvelope);

      // 6. Atomic commit
      this.envelopes.set(spaceId, candidateEnvelope);
      return candidateEnvelope;
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
   * Loads all persisted SpaceHeaderEnvelopes from an IStorageAdapter.
   *
   * @param adapter The persistent storage adapter (e.g. IndexedDBStorageAdapter)
   * @returns Number of envelopes loaded into memory
   */
  public async loadEnvelopesFromStorage(adapter: { isInitialized(): boolean; init(): Promise<void>; listEnvelopes(): Promise<SpaceHeaderEnvelope[]> }): Promise<number> {
    if (!adapter.isInitialized()) {
      await adapter.init();
    }
    const persistedEnvelopes = await adapter.listEnvelopes();
    for (const envelope of persistedEnvelopes) {
      validateSpaceEnvelope(envelope);
      this.envelopes.set(envelope.spaceId, envelope);
    }
    return persistedEnvelopes.length;
  }

  /**
   * Persists a SpaceHeaderEnvelope to an IStorageAdapter.
   */
  public async saveEnvelopeToStorage(envelope: SpaceHeaderEnvelope, adapter: { isInitialized(): boolean; init(): Promise<void>; saveEnvelope(env: SpaceHeaderEnvelope): Promise<void> }): Promise<void> {
    if (!adapter.isInitialized()) {
      await adapter.init();
    }
    validateSpaceEnvelope(envelope);
    await adapter.saveEnvelope(envelope);
  }

  /**
   * Deletes a Space from memory and the persistent storage adapter.
   */
  public async deleteSpaceWithStorage(spaceId: string, adapter: { isInitialized(): boolean; init(): Promise<void>; deleteEnvelope(id: string): Promise<boolean> }): Promise<void> {
    this.deleteSpace(spaceId);
    if (!adapter.isInitialized()) {
      await adapter.init();
    }
    await adapter.deleteEnvelope(spaceId);
  }

  /**
   * Clears all envelopes and active sessions.
   */
  public reset(): void {
    this.lockAll();
    this.envelopes.clear();
  }
}

export { SpaceVaultManager as SpaceVault };

