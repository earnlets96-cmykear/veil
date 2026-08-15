import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { SenderKeySession } from '../src/group/senderKey.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 5: Group Rollback & Downgrade Attack Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('should reject rollback of SenderKeySession outbound epoch', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessA = vault.unlockSpace('PassA');
    const docA = idMgr.createIdentity(sessA, store);

    const senderSession = new SenderKeySession('grp_test', 5, docA.identityId);
    expect(senderSession.epoch).toBe(5);

    // Advance to epoch 6
    senderSession.resetOutboundKey(6);
    expect(senderSession.epoch).toBe(6);

    // Rollback attempt to epoch 4 -> MUST THROW
    expect(() => senderSession.resetOutboundKey(4)).toThrow(/Cannot rollback epoch/);
  });
});
