import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Group Crash Recovery & Persistence Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('should persist and cleanly recover group state and sender keys across lock/unlock cycles', () => {
    vault.createSpace({ name: 'Alice Space', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });

    let session = vault.unlockSpace('Password123!');
    const doc = idMgr.createIdentity(session, store);

    let groupMgr = new GroupManager(store, idMgr);
    const { state } = groupMgr.createGroup(session, { name: 'Persistence Group' });

    // Send a message to advance sender key state
    groupMgr.encryptGroupMessage(session, state.groupId, 'Message before crash');

    // 1. Crash / Lock Space
    session.destroy();

    // 2. Unlock Space again with password
    session = vault.unlockSpace('Password123!');
    groupMgr = new GroupManager(store, idMgr);

    // 3. Verify GroupState is intact
    const reloadedState = groupMgr.loadGroupState(session, state.groupId);
    expect(reloadedState).not.toBeNull();
    expect(reloadedState!.groupId).toBe(state.groupId);
    expect(reloadedState!.epoch).toBe(1);
    expect(reloadedState!.members[doc.identityId]).toBeDefined();

    // 4. Verify message history is preserved
    const messages = groupMgr.getGroupMessages(session, state.groupId);
    expect(messages.length).toBe(1);
    expect(messages[0].text).toBe('Message before crash');

    // 5. Send new message after recovery
    const { payload } = groupMgr.encryptGroupMessage(session, state.groupId, 'Message after recovery');
    expect(payload.header.sequenceNum).toBe(1);
  });
});
