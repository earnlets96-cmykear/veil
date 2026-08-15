import { describe, it, expect } from 'vitest';
import { BIP39 } from '../src/recovery/bip39.ts';
import { RecoveryVault } from '../src/recovery/recoveryVault.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { getRandomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 9 Red-Team Audit: Device & Recovery Attacks', () => {
  it('BIP-39 CHECKSUM TAMPERING: Rejects tampered word in 24-word phrase', () => {
    const smk = getRandomBytes(32);
    const validPhrase = BIP39.entropyToMnemonic(smk);
    const words = validPhrase.split(' ');

    // Tamper with the first word
    words[0] = words[0] === 'abandon' ? 'ability' : 'abandon';
    const tamperedPhrase = words.join(' ');

    expect(() => BIP39.mnemonicToEntropy(tamperedPhrase)).toThrow();
  });

  it('BACKUP FILE TAMPERING: Rejects corrupted backup file bytes', () => {
    const vault = new SpaceVaultManager();
    const h = vault.createSpace({ name: 'Vault', password: 'p1', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = vault.unlockSpace('p1', h.spaceId);

    const backupPkg = RecoveryVault.exportEncryptedRecoveryFile(sess, 'Vault', 'BackupPass123!', FAST_TEST_KDF_PARAMS);

    // Corrupt the ciphertext
    const corruptedPkg = {
      ...backupPkg,
      encryptedPayload: {
        ...backupPkg.encryptedPayload,
        ciphertext: backupPkg.encryptedPayload.ciphertext.slice(0, -4) + 'AAAA',
      },
    };

    expect(() => RecoveryVault.importFromRecoveryFile(corruptedPkg, 'BackupPass123!', 'newPass', vault, FAST_TEST_KDF_PARAMS)).toThrow();
  });
});

