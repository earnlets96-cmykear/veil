import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Cross-Group and Cross-Space Cryptographic Isolation', () => {
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

  it('CROSS-GROUP ISOLATION: Group A ciphertext cannot be decrypted by Group B participants', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessA = vault.unlockSpace('PassA');
    const docA = idMgr.createIdentity(sessA, store);

    // Alice creates two independent groups
    const grp1 = groupMgr.createGroup(sessA, { name: 'Group 1' });
    const grp2 = groupMgr.createGroup(sessA, { name: 'Group 2' });

    expect(grp1.state.groupId).not.toBe(grp2.state.groupId);

    // Alice sends a message to Group 1
    const { payload: grp1Payload } = groupMgr.encryptGroupMessage(sessA, grp1.state.groupId, 'Confidential G1');

    // Attempting to decrypt Group 1 message under Group 2 context fails
    const tamperedPayloadForG2 = {
      ...grp1Payload,
      header: {
        ...grp1Payload.header,
        groupId: grp2.state.groupId,
      },
    };

    expect(() =>
      groupMgr.decryptGroupMessage(sessA, tamperedPayloadForG2, base64ToBytes(docA.signingPublicKey))
    ).toThrow();
  });

  it('CROSS-SPACE ISOLATION: Main Space cannot access Private Space group state or messages', () => {
    vault.createSpace({ name: 'Main Space', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private Space', password: 'PassPrivate', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessMain = vault.unlockSpace('PassMain');
    const sessPrivate = vault.unlockSpace('PassPrivate');

    idMgr.createIdentity(sessMain, store);
    idMgr.createIdentity(sessPrivate, store);

    // Create group inside Private Space
    const { state: privateGrp } = groupMgr.createGroup(sessPrivate, { name: 'Private Group' });

    // Main Space attempts to load Private Space's group state -> returns null
    const loadedFromMain = groupMgr.loadGroupState(sessMain, privateGrp.groupId);
    expect(loadedFromMain).toBeNull();
  });
});
