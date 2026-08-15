import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Group Replay Attack Tests', () => {
  let vault: SpaceVaultManager;
  let storeA: EncryptedSpaceStore;
  let storeB: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let groupMgrA: GroupManager;
  let groupMgrB: GroupManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    storeA = new EncryptedSpaceStore();
    storeB = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    groupMgrA = new GroupManager(storeA, idMgr);
    groupMgrB = new GroupManager(storeB, idMgr);
  });

  it('should detect and reject replayed group messages', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessA = vault.unlockSpace('PassA');
    const sessB = vault.unlockSpace('PassB');

    const docA = idMgr.createIdentity(sessA, storeA);
    const docB = idMgr.createIdentity(sessB, storeB);

    const { state, senderSession } = groupMgrA.createGroup(sessA, { name: 'Replay Test' });
    const { distribution } = groupMgrA.addMember(sessA, state.groupId, docB.identityId, docB.signingPublicKey);

    groupMgrB.saveGroupState(sessB, groupMgrA.loadGroupState(sessA, state.groupId)!);
    groupMgrB.processSenderKeyDistribution(sessB, distribution, base64ToBytes(docA.signingPublicKey));

    // Alice sends message
    const { payload } = groupMgrA.encryptGroupMessage(sessA, state.groupId, 'Transfer $500');

    // Bob decrypts message once -> SUCCESS
    const decrypted1 = groupMgrB.decryptGroupMessage(sessB, payload, base64ToBytes(docA.signingPublicKey));
    expect(decrypted1.text).toBe('Transfer $500');

    // Adversary replays identical ciphertext payload -> MUST BE REJECTED
    expect(() =>
      groupMgrB.decryptGroupMessage(sessB, payload, base64ToBytes(docA.signingPublicKey))
    ).toThrow(/Replay detected/);
  });
});
