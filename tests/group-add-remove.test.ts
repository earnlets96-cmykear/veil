import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Member Addition & Removal (Key Rotation & Forward Secrecy)', () => {
  let vault: SpaceVaultManager;
  let storeAlice: EncryptedSpaceStore;
  let storeBob: EncryptedSpaceStore;
  let storeCharlie: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let groupMgrAlice: GroupManager;
  let groupMgrBob: GroupManager;
  let groupMgrCharlie: GroupManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    storeAlice = new EncryptedSpaceStore();
    storeBob = new EncryptedSpaceStore();
    storeCharlie = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();

    groupMgrAlice = new GroupManager(storeAlice, idMgr);
    groupMgrBob = new GroupManager(storeBob, idMgr);
    groupMgrCharlie = new GroupManager(storeCharlie, idMgr);
  });

  it('FORWARD SECRECY ON REMOVAL: Removed member cannot decrypt post-removal messages', () => {
    // 1. Create Spaces & Identities for Alice, Bob, Charlie
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Charlie', password: 'PassC', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessAlice = vault.unlockSpace('PassA');
    const sessBob = vault.unlockSpace('PassB');
    const sessCharlie = vault.unlockSpace('PassC');

    const docAlice = idMgr.createIdentity(sessAlice, storeAlice);
    const docBob = idMgr.createIdentity(sessBob, storeBob);
    const docCharlie = idMgr.createIdentity(sessCharlie, storeCharlie);

    // 2. Alice creates group (Epoch 1)
    const { state: groupState, senderSession: aliceSender1 } = groupMgrAlice.createGroup(sessAlice, {
      name: 'Project Orion',
    });
    const groupId = groupState.groupId;

    // 3. Alice adds Bob and Charlie
    const { distribution: distAliceToBob } = groupMgrAlice.addMember(
      sessAlice,
      groupId,
      docBob.identityId,
      docBob.signingPublicKey
    );
    groupMgrAlice.addMember(
      sessAlice,
      groupId,
      docCharlie.identityId,
      docCharlie.signingPublicKey
    );

    // Synchronize initial state & sender keys to Bob & Charlie
    const updatedState = groupMgrAlice.loadGroupState(sessAlice, groupId)!;
    groupMgrBob.saveGroupState(sessBob, updatedState);
    groupMgrCharlie.saveGroupState(sessCharlie, updatedState);

    // Bob processes Alice's distribution
    groupMgrBob.processSenderKeyDistribution(
      sessBob,
      distAliceToBob,
      base64ToBytes(docAlice.signingPublicKey)
    );

    // Charlie processes Alice's distribution
    const idAlice = idMgr.loadIdentity(sessAlice, storeAlice)!;
    const distAliceToCharlie = aliceSender1.exportDistribution(idAlice.signingPrivateKey);
    groupMgrCharlie.processSenderKeyDistribution(
      sessCharlie,
      distAliceToCharlie,
      base64ToBytes(docAlice.signingPublicKey)
    );

    // 4. Alice sends Message 1 in Epoch 1 (Both Bob and Charlie receive & decrypt)
    const { payload: msg1Payload } = groupMgrAlice.encryptGroupMessage(
      sessAlice,
      groupId,
      'Welcome to Epoch 1 of Project Orion'
    );

    const bobDecrypted1 = groupMgrBob.decryptGroupMessage(
      sessBob,
      msg1Payload,
      base64ToBytes(docAlice.signingPublicKey)
    );
    expect(bobDecrypted1.text).toBe('Welcome to Epoch 1 of Project Orion');

    const charlieDecrypted1 = groupMgrCharlie.decryptGroupMessage(
      sessCharlie,
      msg1Payload,
      base64ToBytes(docAlice.signingPublicKey)
    );
    expect(charlieDecrypted1.text).toBe('Welcome to Epoch 1 of Project Orion');

    // 5. Alice REMOVES Bob -> Epoch advances to 2, Alice's SenderKey is rotated
    const { distribution: distAliceEpoch2 } = groupMgrAlice.removeMember(
      sessAlice,
      groupId,
      docBob.identityId
    );

    const epoch2State = groupMgrAlice.loadGroupState(sessAlice, groupId)!;
    expect(epoch2State.epoch).toBe(2);
    expect(epoch2State.members[docBob.identityId]).toBeUndefined();

    // Alice syncs epoch 2 state & new SenderKey to Charlie only (NOT to Bob)
    groupMgrCharlie.saveGroupState(sessCharlie, epoch2State);
    groupMgrCharlie.processSenderKeyDistribution(
      sessCharlie,
      distAliceEpoch2,
      base64ToBytes(docAlice.signingPublicKey)
    );

    // 6. Alice sends Message 2 in Epoch 2
    const { payload: msg2Payload } = groupMgrAlice.encryptGroupMessage(
      sessAlice,
      groupId,
      'Confidential Epoch 2 message after Bob removal'
    );
    expect(msg2Payload.header.epoch).toBe(2);

    // 7. Charlie successfully decrypts Epoch 2 message
    const charlieDecrypted2 = groupMgrCharlie.decryptGroupMessage(
      sessCharlie,
      msg2Payload,
      base64ToBytes(docAlice.signingPublicKey)
    );
    expect(charlieDecrypted2.text).toBe('Confidential Epoch 2 message after Bob removal');

    // 8. Bob attempts to decrypt Epoch 2 message -> MUST FAIL (Epoch mismatch / missing Epoch 2 key)
    expect(() =>
      groupMgrBob.decryptGroupMessage(
        sessBob,
        msg2Payload,
        base64ToBytes(docAlice.signingPublicKey)
      )
    ).toThrow();
  });
});
