/**
 * Zero-Knowledge Serverless Recovery Vault for VEIL.
 *
 * Implements client-side BIP-39 mnemonic phrase backup/recovery
 * and standalone encrypted .veilbackup file export/import.
 */

import { BIP39 } from './bip39.ts';
import { SpaceVaultManager } from '../spaces/vault.ts';
import { SpaceSession } from '../spaces/session.ts';
import { deriveKeyArgon2id, FAST_TEST_KDF_PARAMS } from '../crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes, getRandomBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import { KdfParameters } from '../types/index.ts';

export interface EncryptedRecoveryFile {
  format: 'VEIL-RECOVERY-v1';
  version: 1;
  spaceId: string;
  name: string;
  kdfParams: KdfParameters;
  encryptedPayload: {
    algorithm: 'XChaCha20-Poly1305';
    nonce: string;
    ciphertext: string;
  };
  exportedAt: number;
}

export class RecoveryVault {
  /**
   * Exports the 24-word BIP-39 mnemonic recovery phrase for the active Space.
   */
  public static exportMnemonicPhrase(session: SpaceSession): string {
    this.assertSession(session);
    const masterKey = session.getMasterKey();
    return BIP39.entropyToMnemonic(masterKey);
  }

  /**
   * Recreates a Space from a 24-word BIP-39 mnemonic phrase without server communication.
   */
  public static recoverSpaceFromMnemonic(
    mnemonic: string,
    spaceName: string,
    password: string,
    vault: SpaceVaultManager,
    kdfParams?: Partial<KdfParameters>
  ): { spaceId: string; session: SpaceSession } {
    // 1. Decode mnemonic to Space Master Key
    const recoveredMasterKey = BIP39.mnemonicToEntropy(mnemonic);

    try {
      // 2. Create Space with existing Master Key
      const spaceHeader = vault.createSpace({
        name: spaceName,
        password,
        masterKey: recoveredMasterKey,
        kdfParams,
      });

      // 3. Unlock Space
      const session = vault.unlockSpace(password, spaceHeader.spaceId);
      return { spaceId: spaceHeader.spaceId, session };
    } finally {
      zeroize(recoveredMasterKey);
    }
  }

  /**
   * Exports an encrypted standalone backup file (.veilbackup) protected by a passphrase.
   */
  public static exportEncryptedRecoveryFile(
    session: SpaceSession,
    spaceName: string,
    passphrase: string,
    customKdfParams?: Partial<KdfParameters>
  ): EncryptedRecoveryFile {
    this.assertSession(session);
    if (!passphrase || passphrase.length < 3) {
      throw new Error('Recovery passphrase must be at least 3 characters long');
    }

    const salt = getRandomBytes(32);
    const kdfParams: KdfParameters = {
      algorithm: 'argon2id',
      salt: bytesToBase64(salt),
      timeCost: customKdfParams?.timeCost ?? 3,
      memoryCost: customKdfParams?.memoryCost ?? 65536,
      parallelism: customKdfParams?.parallelism ?? 1,
      keyLength: 32,
    };

    const kek = deriveKeyArgon2id(passphrase, salt, kdfParams);
    const masterKey = session.getMasterKey();

    const payload = JSON.stringify({
      spaceId: session.spaceId,
      name: spaceName,
      masterKeyBase64: bytesToBase64(masterKey),
      exportedAt: Date.now(),
    });

    const aad = new TextEncoder().encode(`VEIL-RECOVERY-v1|spaceId:${session.spaceId}`);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(kek, payload, aad);

    zeroize(kek);

    return {
      format: 'VEIL-RECOVERY-v1',
      version: 1,
      spaceId: session.spaceId,
      name: spaceName,
      kdfParams,
      encryptedPayload: {
        algorithm: 'XChaCha20-Poly1305',
        nonce: bytesToBase64(nonce),
        ciphertext: bytesToBase64(ciphertext),
      },
      exportedAt: Date.now(),
    };
  }

  /**
   * Restores a Space from an encrypted backup file using the recovery passphrase.
   */
  public static importFromRecoveryFile(
    backup: EncryptedRecoveryFile | string,
    passphrase: string,
    newPassword: string,
    vault: SpaceVaultManager,
    customKdfParams?: Partial<KdfParameters>
  ): { spaceId: string; session: SpaceSession } {
    const file: EncryptedRecoveryFile = typeof backup === 'string' ? JSON.parse(backup) : backup;

    if (file.format !== 'VEIL-RECOVERY-v1' || file.version !== 1) {
      throw new Error(`Unsupported recovery file format: ${file.format}`);
    }

    const salt = base64ToBytes(file.kdfParams.salt);
    const kek = deriveKeyArgon2id(passphrase, salt, file.kdfParams);

    const nonce = base64ToBytes(file.encryptedPayload.nonce);
    const ciphertext = base64ToBytes(file.encryptedPayload.ciphertext);
    const aad = new TextEncoder().encode(`VEIL-RECOVERY-v1|spaceId:${file.spaceId}`);

    let masterKey: Uint8Array;
    try {
      const plaintextBytes = decryptXChaCha20Poly1305(kek, nonce, ciphertext, aad);
      const parsed = JSON.parse(new TextDecoder().decode(plaintextBytes));
      masterKey = base64ToBytes(parsed.masterKeyBase64);
    } catch (_e) {
      throw new Error('Recovery file decryption failed: invalid passphrase or corrupted backup file');
    } finally {
      zeroize(kek);
    }

    try {
      const spaceHeader = vault.createSpace({
        name: file.name,
        password: newPassword,
        masterKey,
        kdfParams: customKdfParams,
      });

      const session = vault.unlockSpace(newPassword, spaceHeader.spaceId);
      return { spaceId: spaceHeader.spaceId, session };
    } finally {
      zeroize(masterKey);
    }
  }

  private static assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('RecoveryVault rejected: Space session is locked or destroyed');
    }
  }
}
