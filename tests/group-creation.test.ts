import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { GroupStateManager } from '../src/group/groupState.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 5: Group Creation Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let groupMgr: GroupManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    groupMgr = new GroupManager(store, idMgr);
  });

  it('should create group with random ID, creator role, initial epoch 1, and signed genesis action', () => {
    vault.createSpace({ name: 'Alice Space', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!');
    const aliceDoc = idMgr.createIdentity(session, store);

    const { state, senderSession, groupMasterSecret } = groupMgr.createGroup(session, {
      name: 'Security WG',
      description: 'Zero-trust group chat',
    });

    expect(state.groupId).toMatch(/^grp_[a-zA-Z0-9_-]{16,32}$/);
    expect(state.epoch).toBe(1);
    expect(state.creatorIdentityId).toBe(aliceDoc.identityId);
    expect(state.members[aliceDoc.identityId]).toBeDefined();
    expect(state.members[aliceDoc.identityId].role).toBe('CREATOR');
    expect(state.actionHistory.length).toBe(1);
    expect(state.actionHistory[0].actionType).toBe('CREATE_GROUP');
    expect(state.actionHistory[0].actorIdentityId).toBe(aliceDoc.identityId);
    expect(state.actionHistory[0].signature).toBeTruthy();

    expect(senderSession.groupId).toBe(state.groupId);
    expect(senderSession.epoch).toBe(1);
    expect(senderSession.myIdentityId).toBe(aliceDoc.identityId);

    // Decrypt metadata
    const decryptedMeta = GroupStateManager.decryptMetadata(state, groupMasterSecret);
    expect(decryptedMeta.name).toBe('Security WG');
    expect(decryptedMeta.description).toBe('Zero-trust group chat');
  });

  it('should generate distinct cryptographically random group IDs for each group', () => {
    vault.createSpace({ name: 'Alice Space', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!');
    idMgr.createIdentity(session, store);

    const group1 = groupMgr.createGroup(session, { name: 'Group 1' });
    const group2 = groupMgr.createGroup(session, { name: 'Group 2' });
    const group3 = groupMgr.createGroup(session, { name: 'Group 3' });

    expect(group1.state.groupId).not.toBe(group2.state.groupId);
    expect(group2.state.groupId).not.toBe(group3.state.groupId);
    expect(group1.state.groupId).not.toBe(group3.state.groupId);
  });
});
