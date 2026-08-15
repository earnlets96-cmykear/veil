import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Group Message Out-of-Order Delivery Tests', () => {
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

  it('should correctly decrypt messages delivered out of order [1, 3, 2] via skipped message keys', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessA = vault.unlockSpace('PassA');
    const sessB = vault.unlockSpace('PassB');

    const docA = idMgr.createIdentity(sessA, storeA);
    const docB = idMgr.createIdentity(sessB, storeB);

    const { state } = groupMgrA.createGroup(sessA, { name: 'Ordering Test' });
    const { distribution } = groupMgrA.addMember(sessA, state.groupId, docB.identityId, docB.signingPublicKey);

    groupMgrB.saveGroupState(sessB, groupMgrA.loadGroupState(sessA, state.groupId)!);
    groupMgrB.processSenderKeyDistribution(sessB, distribution, base64ToBytes(docA.signingPublicKey));

    // Alice sends messages 1, 2, 3
    const msg1 = groupMgrA.encryptGroupMessage(sessA, state.groupId, 'Message 1');
    const msg2 = groupMgrA.encryptGroupMessage(sessA, state.groupId, 'Message 2');
    const msg3 = groupMgrA.encryptGroupMessage(sessA, state.groupId, 'Message 3');

    // Bob receives in order: 1 -> 3 -> 2
    const d1 = groupMgrB.decryptGroupMessage(sessB, msg1.payload, base64ToBytes(docA.signingPublicKey));
    expect(d1.text).toBe('Message 1');

    const d3 = groupMgrB.decryptGroupMessage(sessB, msg3.payload, base64ToBytes(docA.signingPublicKey));
    expect(d3.text).toBe('Message 3');

    const d2 = groupMgrB.decryptGroupMessage(sessB, msg2.payload, base64ToBytes(docA.signingPublicKey));
    expect(d2.text).toBe('Message 2');
  });
});
