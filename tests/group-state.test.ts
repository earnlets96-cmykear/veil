import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupStateManager } from '../src/group/groupState.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Group State Signature & Anti-Tampering Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('should reject group actions with tampered parameters or forged signatures', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessA = vault.unlockSpace('PassA');
    const sessB = vault.unlockSpace('PassB');

    const docA = idMgr.createIdentity(sessA, store);
    const idA = idMgr.loadIdentity(sessA, store)!;

    const docB = idMgr.createIdentity(sessB, store);

    const { state } = GroupStateManager.createGroup(
      docA.identityId,
      docA.signingPublicKey,
      idA.signingPrivateKey,
      { name: 'State Test' }
    );

    const addAction = GroupStateManager.addMember(
      state,
      docA.identityId,
      idA.signingPrivateKey,
      docB.identityId,
      docB.signingPublicKey,
      'MEMBER'
    );

    // Tamper with action: change role to CREATOR without re-signing
    const tamperedAction = {
      ...addAction,
      newRole: 'CREATOR' as const,
    };

    expect(() =>
      GroupStateManager.verifyAndApplyAction(state, tamperedAction, base64ToBytes(docA.signingPublicKey))
    ).toThrow(/Invalid signature/);
  });
});
