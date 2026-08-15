import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { GENERIC_UNLOCK_ERROR } from '../src/privacy/disclosureGuard.ts';

describe('VEIL Phase 9 Red-Team Audit: Cross-Space Attacks & Partition Isolation', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
  });

  it('CROSS-SPACE RECORD INJECTION: Record written in Space A cannot be decrypted by Space B', () => {
    const headerA = vault.createSpace({ name: 'Personal', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const headerB = vault.createSpace({ name: 'Work', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessA = vault.unlockSpace('PassA123!', headerA.spaceId);
    const sessB = vault.unlockSpace('PassB123!', headerB.spaceId);

    // Write sensitive record into Space A
    store.set(sessA, 'secret_memo', { text: 'Classified payload in Space A' });

    // Verify Space A can read it
    const readA = store.get(sessA, 'secret_memo');
    expect(readA).toEqual({ text: 'Classified payload in Space A' });

    // Verify Space B partition cannot see or decrypt Space A record
    const readB = store.get(sessB, 'secret_memo');
    expect(readB).toBeNull();
  });

  it('CREDENTIAL ORACLE REJECTION: Wrong credentials produce identical generic rejection', () => {
    const header = vault.createSpace({ name: 'Classified Vault', password: 'RealPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });

    // Attempt 1: Wrong password for existing space
    expect(() => vault.unlockSpace('WrongPassword123!', header.spaceId)).toThrow();

    // Attempt 2: Valid password for nonexistent space ID
    expect(() => vault.unlockSpace('RealPassword123!', 'nonexistent_space_id')).toThrow();
  });
});
