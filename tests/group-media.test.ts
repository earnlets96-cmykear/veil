import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { MediaVault } from '../src/media/mediaVault.ts';
import { InMemoryMediaRelay } from '../src/media/mediaStorage.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { getRandomBytes, base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Complete End-to-End Group & Encrypted Media Integration', () => {
  let vault: SpaceVaultManager;
  let storeAlice: EncryptedSpaceStore;
  let storeBob: EncryptedSpaceStore;
  let storeCharlie: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let groupMgrAlice: GroupManager;
  let groupMgrBob: GroupManager;
  let groupMgrCharlie: GroupManager;
  let mediaVaultAlice: MediaVault;
  let mediaVaultBob: MediaVault;
  let mediaVaultCharlie: MediaVault;
  let relay: InMemoryMediaRelay;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    storeAlice = new EncryptedSpaceStore();
    storeBob = new EncryptedSpaceStore();
    storeCharlie = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();

    groupMgrAlice = new GroupManager(storeAlice, idMgr);
    groupMgrBob = new GroupManager(storeBob, idMgr);
    groupMgrCharlie = new GroupManager(storeCharlie, idMgr);

    mediaVaultAlice = new MediaVault(storeAlice);
    mediaVaultBob = new MediaVault(storeBob);
    mediaVaultCharlie = new MediaVault(storeCharlie);

    relay = new InMemoryMediaRelay();
  });

  it('COMPLETE E2EE GROUP + MEDIA FLOW: Creation -> Add members -> Media upload/download -> Remove member -> Key rotation blocks removed member', async () => {
    // 1. Create Spaces & Identities
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Charlie', password: 'PassC', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessAlice = vault.unlockSpace('PassA');
    const sessBob = vault.unlockSpace('PassB');
    const sessCharlie = vault.unlockSpace('PassC');

    const docAlice = idMgr.createIdentity(sessAlice, storeAlice);
    const docBob = idMgr.createIdentity(sessBob, storeBob);
    const docCharlie = idMgr.createIdentity(sessCharlie, storeCharlie);

    const idAlice = idMgr.loadIdentity(sessAlice, storeAlice)!;
    const idBob = idMgr.loadIdentity(sessBob, storeBob)!;
    const idCharlie = idMgr.loadIdentity(sessCharlie, storeCharlie)!;

    // 2. Alice creates group (Epoch 1)
    const { state: groupState, senderSession: aliceSender } = groupMgrAlice.createGroup(sessAlice, {
      name: 'VEIL Core WG',
    });
    const groupId = groupState.groupId;

    // 3. Alice adds Bob and Charlie
    const { distribution: distAliceToBob } = groupMgrAlice.addMember(
      sessAlice,
      groupId,
      docBob.identityId,
      docBob.signingPublicKey
    );
    const { distribution: distAliceToCharlie } = groupMgrAlice.addMember(
      sessAlice,
      groupId,
      docCharlie.identityId,
      docCharlie.signingPublicKey
    );

    const stateEpoch1 = groupMgrAlice.loadGroupState(sessAlice, groupId)!;
    groupMgrBob.saveGroupState(sessBob, stateEpoch1);
    groupMgrCharlie.saveGroupState(sessCharlie, stateEpoch1);

    groupMgrBob.processSenderKeyDistribution(sessBob, distAliceToBob, base64ToBytes(docAlice.signingPublicKey));
    groupMgrCharlie.processSenderKeyDistribution(sessCharlie, distAliceToCharlie, base64ToBytes(docAlice.signingPublicKey));

    // Bob exports his SenderKey and distributes to Alice & Charlie
    const bobSender = groupMgrBob.getOrLoadSenderKeySession(sessBob, groupId, 1);
    const distBob = bobSender.exportDistribution(idBob.signingPrivateKey);
    groupMgrAlice.processSenderKeyDistribution(sessAlice, distBob, base64ToBytes(docBob.signingPublicKey));
    groupMgrCharlie.processSenderKeyDistribution(sessCharlie, distBob, base64ToBytes(docBob.signingPublicKey));

    // Charlie exports his SenderKey and distributes to Alice & Bob
    const charlieSender = groupMgrCharlie.getOrLoadSenderKeySession(sessCharlie, groupId, 1);
    const distCharlie = charlieSender.exportDistribution(idCharlie.signingPrivateKey);
    groupMgrAlice.processSenderKeyDistribution(sessAlice, distCharlie, base64ToBytes(docCharlie.signingPublicKey));
    groupMgrBob.processSenderKeyDistribution(sessBob, distCharlie, base64ToBytes(docCharlie.signingPublicKey));

    // 4. Alice sends text message
    const { payload: aliceMsgPayload } = groupMgrAlice.encryptGroupMessage(sessAlice, groupId, 'Hello everyone!');
    const bobMsg1 = groupMgrBob.decryptGroupMessage(sessBob, aliceMsgPayload, base64ToBytes(docAlice.signingPublicKey));
    expect(bobMsg1.text).toBe('Hello everyone!');

    // 5. Bob replies
    const { payload: bobMsgPayload } = groupMgrBob.encryptGroupMessage(sessBob, groupId, 'Hi Alice and Charlie!');
    const aliceMsg1 = groupMgrAlice.decryptGroupMessage(sessAlice, bobMsgPayload, base64ToBytes(docBob.signingPublicKey));
    expect(aliceMsg1.text).toBe('Hi Alice and Charlie!');

    // 6. Charlie sends an encrypted image (Media 1)
    const image1Bytes = getRandomBytes(1024 * 80);
    const image1Meta = { filename: 'design_spec.png', mimeType: 'image/png', sizeBytes: image1Bytes.length };
    const capToken1 = 'cap_media_token_1';

    const { attachment: mediaAttach1 } = await mediaVaultCharlie.prepareAndUploadMedia(
      sessCharlie,
      image1Bytes,
      image1Meta,
      relay,
      capToken1
    );

    // Charlie announces image in group message
    const { payload: charlieMediaMsgPayload } = groupMgrCharlie.encryptGroupMessage(
      sessCharlie,
      groupId,
      'Here is the design spec',
      mediaAttach1
    );

    // 7. Bob receives group message, downloads and decrypts the image
    const bobReceivedMediaMsg = groupMgrBob.decryptGroupMessage(
      sessBob,
      charlieMediaMsgPayload,
      base64ToBytes(docCharlie.signingPublicKey)
    );
    expect(bobReceivedMediaMsg.attachment).toBeDefined();

    const bobDecryptedMedia = await mediaVaultBob.downloadAndDecryptMedia(
      sessBob,
      bobReceivedMediaMsg.attachment,
      capToken1,
      relay
    );
    expect(bobDecryptedMedia.plaintext).toEqual(image1Bytes);
    expect(bobDecryptedMedia.metadata.filename).toBe('design_spec.png');

    // 8. Remove Bob -> advances to Epoch 2
    const { distribution: aliceDistEpoch2 } = groupMgrAlice.removeMember(sessAlice, groupId, docBob.identityId);
    const stateEpoch2 = groupMgrAlice.loadGroupState(sessAlice, groupId)!;
    expect(stateEpoch2.epoch).toBe(2);

    // Sync epoch 2 state to Charlie
    groupMgrCharlie.saveGroupState(sessCharlie, stateEpoch2);
    groupMgrCharlie.processSenderKeyDistribution(sessCharlie, aliceDistEpoch2, base64ToBytes(docAlice.signingPublicKey));

    // Charlie rotates his sender key for Epoch 2 and shares with Alice
    const charlieSender2 = groupMgrCharlie.getOrLoadSenderKeySession(sessCharlie, groupId, 1);
    charlieSender2.resetOutboundKey(2);
    const charlieDistEpoch2 = charlieSender2.exportDistribution(idCharlie.signingPrivateKey);
    groupMgrAlice.processSenderKeyDistribution(sessAlice, charlieDistEpoch2, base64ToBytes(docCharlie.signingPublicKey));

    // 9. Charlie sends Media 2 in Epoch 2
    const image2Bytes = getRandomBytes(1024 * 60);
    const image2Meta = { filename: 'secret_phase2.png', mimeType: 'image/png', sizeBytes: image2Bytes.length };
    const capToken2 = 'cap_media_token_2';

    const { attachment: mediaAttach2 } = await mediaVaultCharlie.prepareAndUploadMedia(
      sessCharlie,
      image2Bytes,
      image2Meta,
      relay,
      capToken2
    );

    const { payload: charlieMedia2Payload } = groupMgrCharlie.encryptGroupMessage(
      sessCharlie,
      groupId,
      'Confidential diagram for Epoch 2',
      mediaAttach2
    );
    expect(charlieMedia2Payload.header.epoch).toBe(2);

    // 10. Verify Bob CANNOT decrypt the second image group message
    expect(() =>
      groupMgrBob.decryptGroupMessage(
        sessBob,
        charlieMedia2Payload,
        base64ToBytes(docCharlie.signingPublicKey)
      )
    ).toThrow();

    // 11. Verify Alice CAN decrypt the second image
    const aliceReceivedMedia2 = groupMgrAlice.decryptGroupMessage(
      sessAlice,
      charlieMedia2Payload,
      base64ToBytes(docCharlie.signingPublicKey)
    );
    const aliceDecryptedMedia2 = await mediaVaultAlice.downloadAndDecryptMedia(
      sessAlice,
      aliceReceivedMedia2.attachment,
      capToken2,
      relay
    );
    expect(aliceDecryptedMedia2.plaintext).toEqual(image2Bytes);
    expect(aliceDecryptedMedia2.metadata.filename).toBe('secret_phase2.png');

    // 12. Verify server only possesses opaque ciphertexts (cannot decrypt either image)
    const rawRelayEntry1 = relay.getRawEntry(mediaAttach1.mediaId)!;
    const rawRelayEntry2 = relay.getRawEntry(mediaAttach2.mediaId)!;
    expect(rawRelayEntry1.chunks[0].ciphertext).not.toContain('design_spec.png');
    expect(rawRelayEntry2.chunks[0].ciphertext).not.toContain('secret_phase2.png');
  });
});
