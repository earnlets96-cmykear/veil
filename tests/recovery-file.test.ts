import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { RecoveryVault } from '../src/recovery/recoveryVault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 6: Encrypted Emergency Recovery File Tests', () => {
  let vaultOriginal: SpaceVaultManager;
  let vaultRestored: SpaceVaultManager;
  let storeOriginal: EncryptedSpaceStore;
  let storeRestored: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vaultOriginal = new SpaceVaultManager();
    vaultRestored = new SpaceVaultManager();
    storeOriginal = new EncryptedSpaceStore();
    storeRestored = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('should export encrypted backup file and restore Space with correct passphrase', () => {
    vaultOriginal.createSpace({ name: 'Emergency Vault', password: 'SpacePassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessOriginal = vaultOriginal.unlockSpace('SpacePassword123!');
    const originalDoc = idMgr.createIdentity(sessOriginal, storeOriginal);

    const backupPassphrase = 'MyEmergencyRecoveryPassphrase999!';
    const recoveryFile = RecoveryVault.exportEncryptedRecoveryFile(
      sessOriginal,
      'Emergency Vault',
      backupPassphrase,
      FAST_TEST_KDF_PARAMS
    );

    expect(recoveryFile.format).toBe('VEIL-RECOVERY-v1');
    expect(recoveryFile.encryptedPayload.ciphertext).toBeTruthy();

    // Restore on fresh device
    const { session: sessRestored } = RecoveryVault.importFromRecoveryFile(
      recoveryFile,
      backupPassphrase,
      'NewLocalPassword777!',
      vaultRestored,
      FAST_TEST_KDF_PARAMS
    );

    const restoredDoc = idMgr.createIdentity(sessRestored, storeRestored);
    expect(restoredDoc.identityId).toBe(originalDoc.identityId);
  });

  it('should reject backup file import when passphrase is wrong', () => {
    vaultOriginal.createSpace({ name: 'Emergency Vault', password: 'SpacePassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessOriginal = vaultOriginal.unlockSpace('SpacePassword123!');

    const recoveryFile = RecoveryVault.exportEncryptedRecoveryFile(
      sessOriginal,
      'Emergency Vault',
      'CorrectPassphrase123!',
      FAST_TEST_KDF_PARAMS
    );

    expect(() =>
      RecoveryVault.importFromRecoveryFile(
        recoveryFile,
        'WrongPassphrase456!',
        'NewLocalPassword!',
        vaultRestored,
        FAST_TEST_KDF_PARAMS
      )
    ).toThrow(/invalid passphrase/);
  });
});
