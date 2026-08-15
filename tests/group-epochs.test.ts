import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupStateManager } from '../src/group/groupState.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Group Epochs & Stale State Protection', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('should monotonically advance epochs and reject stale epoch rollbacks', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Charlie', password: 'PassC', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessA = vault.unlockSpace('PassA');
    const sessB = vault.unlockSpace('PassB');
    const sessC = vault.unlockSpace('PassC');

    const docA = idMgr.createIdentity(sessA, store);
    const idA = idMgr.loadIdentity(sessA, store)!;

    const docB = idMgr.createIdentity(sessB, store);
    const docC = idMgr.createIdentity(sessC, store);

    // 1. Create Group (Epoch 1)
    const { state } = GroupStateManager.createGroup(
      docA.identityId,
      docA.signingPublicKey,
      idA.signingPrivateKey,
      { name: 'Epoch Test' }
    );
    expect(state.epoch).toBe(1);

    // 2. Add Bob & Charlie (Still Epoch 1)
    GroupStateManager.addMember(state, docA.identityId, idA.signingPrivateKey, docB.identityId, docB.signingPublicKey);
    GroupStateManager.addMember(state, docA.identityId, idA.signingPrivateKey, docC.identityId, docC.signingPublicKey);
    expect(state.epoch).toBe(1);

    // 3. Remove Bob (Epoch 2)
    const remBobAction = GroupStateManager.removeMember(state, docA.identityId, idA.signingPrivateKey, docB.identityId);
    expect(state.epoch).toBe(2);

    // 4. Remove Charlie (Epoch 3)
    const remCharlieAction = GroupStateManager.removeMember(state, docA.identityId, idA.signingPrivateKey, docC.identityId);
    expect(state.epoch).toBe(3);

    // 5. Attempt to apply an old Epoch 1 action on Epoch 3 state -> MUST REJECT
    const staleAction = {
      ...remBobAction,
      epoch: 1, // Malicious stale rollback attempt
    };
    expect(() =>
      GroupStateManager.verifyAndApplyAction(state, staleAction, base64ToBytes(docA.signingPublicKey))
    ).toThrow(/Rollback rejected/);
  });
});
