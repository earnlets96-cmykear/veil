import { describe, it, expect } from 'vitest';
import { GroupStateManager } from '../src/group/groupState.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 9 Red-Team Audit: Protocol State Machine & Ratchet Security', () => {
  it('GROUP EPOCH ROLLBACK ATTACK: Rejects attempts to regress group epoch', () => {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();

    const hAlice = vault.createSpace({ name: 'Alice', password: 'p1', kdfParams: FAST_TEST_KDF_PARAMS });
    const sAlice = vault.unlockSpace('p1', hAlice.spaceId);
    const docAlice = idMgr.createIdentity(sAlice, store);
    const idAlice = idMgr.loadIdentity(sAlice, store)!;

    const { state } = GroupStateManager.createGroup(
      docAlice.identityId,
      docAlice.signingPublicKey,
      idAlice.signingPrivateKey,
      { name: 'Epoch Test' }
    );
    expect(state.epoch).toBe(1);

    // Add Bob and advance epoch
    const hBob = vault.createSpace({ name: 'Bob', password: 'p2', kdfParams: FAST_TEST_KDF_PARAMS });
    const sBob = vault.unlockSpace('p2', hBob.spaceId);
    const docBob = idMgr.createIdentity(sBob, store);

    const addAction = GroupStateManager.addMember(
      state,
      docAlice.identityId,
      idAlice.signingPrivateKey,
      docBob.identityId,
      docBob.signingPublicKey
    );

    // Remove Bob to advance epoch to 2
    const remAction = GroupStateManager.removeMember(
      state,
      docAlice.identityId,
      idAlice.signingPrivateKey,
      docBob.identityId
    );
    expect(state.epoch).toBe(2);

    // Manually attempt an action with epoch 1 (rollback)
    const staleAction = {
      ...remAction,
      epoch: 1, // Stale rollback attempt
    };

    expect(() =>
      GroupStateManager.verifyAndApplyAction(state, staleAction, base64ToBytes(docAlice.signingPublicKey))
    ).toThrow(/Rollback rejected/);
  });
});

