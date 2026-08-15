import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Malicious Server Attacks on Group Messages', () => {
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

  it('MALICIOUS SERVER: Bit-flipped group ciphertext is rejected by recipient', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessA = vault.unlockSpace('PassA');
    const sessB = vault.unlockSpace('PassB');

    const docA = idMgr.createIdentity(sessA, storeA);
    const docB = idMgr.createIdentity(sessB, storeB);

    const { state } = groupMgrA.createGroup(sessA, { name: 'Server Test' });
    const { distribution } = groupMgrA.addMember(sessA, state.groupId, docB.identityId, docB.signingPublicKey);

    groupMgrB.saveGroupState(sessB, groupMgrA.loadGroupState(sessA, state.groupId)!);
    groupMgrB.processSenderKeyDistribution(sessB, distribution, base64ToBytes(docA.signingPublicKey));

    const { payload } = groupMgrA.encryptGroupMessage(sessA, state.groupId, 'Uncorrupted content');

    // Malicious server flips one bit in ciphertext
    const cipherBytes = base64ToBytes(payload.ciphertext);
    cipherBytes[0] ^= 0x01;
    const tamperedPayload = {
      ...payload,
      ciphertext: bytesToBase64(cipherBytes),
    };

    expect(() =>
      groupMgrB.decryptGroupMessage(sessB, tamperedPayload, base64ToBytes(docA.signingPublicKey))
    ).toThrow();
  });

  it('MALICIOUS SERVER: Modified header sequence number causes signature or AEAD failure', () => {
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessA = vault.unlockSpace('PassA');
    const sessB = vault.unlockSpace('PassB');

    const docA = idMgr.createIdentity(sessA, storeA);
    const docB = idMgr.createIdentity(sessB, storeB);

    const { state } = groupMgrA.createGroup(sessA, { name: 'Server Test 2' });
    const { distribution } = groupMgrA.addMember(sessA, state.groupId, docB.identityId, docB.signingPublicKey);

    groupMgrB.saveGroupState(sessB, groupMgrA.loadGroupState(sessA, state.groupId)!);
    groupMgrB.processSenderKeyDistribution(sessB, distribution, base64ToBytes(docA.signingPublicKey));

    const { payload } = groupMgrA.encryptGroupMessage(sessA, state.groupId, 'Original content');

    // Server modifies sequenceNum in header
    const tamperedPayload = {
      ...payload,
      header: {
        ...payload.header,
        sequenceNum: 999,
      },
    };

    expect(() =>
      groupMgrB.decryptGroupMessage(sessB, tamperedPayload, base64ToBytes(docA.signingPublicKey))
    ).toThrow();
  });
});
