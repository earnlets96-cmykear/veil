import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { RecoveryVault } from '../src/recovery/recoveryVault.ts';
import { BIP39 } from '../src/recovery/bip39.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 6: Zero-Knowledge BIP-39 Mnemonic Recovery Tests', () => {
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

  it('should export 24-word BIP-39 mnemonic phrase and restore exact Space identity on new device', () => {
    // 1. Create Space and generate Identity on original device
    vaultOriginal.createSpace({ name: 'Secret Space', password: 'OriginalPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessOriginal = vaultOriginal.unlockSpace('OriginalPassword123!');
    const originalDoc = idMgr.createIdentity(sessOriginal, storeOriginal);

    // 2. Export 24-word mnemonic phrase
    const mnemonic = RecoveryVault.exportMnemonicPhrase(sessOriginal);
    const words = mnemonic.split(' ');
    expect(words.length).toBe(24);
    expect(BIP39.validateMnemonic(mnemonic)).toBe(true);

    // 3. User loses original device -> Restores Space on fresh new device using mnemonic
    const { session: sessRestored } = RecoveryVault.recoverSpaceFromMnemonic(
      mnemonic,
      'Restored Secret Space',
      'BrandNewDevicePassword456!',
      vaultRestored,
      FAST_TEST_KDF_PARAMS
    );

    // 4. Derive identity on restored device
    const restoredDoc = idMgr.createIdentity(sessRestored, storeRestored);

    // 5. Verify restored identity is MATHEMATICALLY IDENTICAL
    expect(restoredDoc.identityId).toBe(originalDoc.identityId);
    expect(restoredDoc.signingPublicKey).toBe(originalDoc.signingPublicKey);
    expect(restoredDoc.keyAgreementPublicKey).toBe(originalDoc.keyAgreementPublicKey);
    expect(restoredDoc.fingerprint).toBe(originalDoc.fingerprint);
  });

  it('should detect corrupted mnemonic phrases and reject invalid checksums', () => {
    vaultOriginal.createSpace({ name: 'Test Space', password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = vaultOriginal.unlockSpace('Pass!');
    const mnemonic = RecoveryVault.exportMnemonicPhrase(sess);

    const words = mnemonic.split(' ');
    // Tamper with the last word
    words[words.length - 1] = words[words.length - 1] === 'abandon' ? 'ability' : 'abandon';
    const corruptedMnemonic = words.join(' ');

    expect(BIP39.validateMnemonic(corruptedMnemonic)).toBe(false);
    expect(() =>
      RecoveryVault.recoverSpaceFromMnemonic(corruptedMnemonic, 'Test', 'Pass', vaultRestored)
    ).toThrow(/checksum verification failed/);
  });
});
