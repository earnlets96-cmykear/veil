import { describe, expect, it } from 'vitest';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { resolveReplyReference } from '../src/ui/app/AppState.tsx';
import { UIMessage } from '../src/ui/app/types.ts';

function createTestPeer(name: string, password: string) {
  const vault = new SpaceVaultManager();
  const envelope = vault.createSpace({ name, password, kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace(password, envelope.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const identities = new SpaceIdentityManager();
  const document = identities.createIdentity(session, store);
  const prekeys = new PrekeyManager(store, identities);
  prekeys.generateSignedPrekey(session);
  prekeys.generateOneTimePrekeys(session, 10);
  return {
    vault,
    session,
    store,
    document,
    identities,
    prekeys,
    manager: new ConversationManager(store, identities, prekeys),
    bundle: prekeys.createPrekeyBundle(session),
  };
}

describe('Phase 45D: Full E2E Reply & Media Workflow with Rehydration', () => {
  it('executes full multi-turn media and text reply cycle with encrypted store rehydration', async () => {
    const alice = createTestPeer('Alice', 'AlicePassword123!');
    const bob = createTestPeer('Bob', 'BobPassword123!');

    // -------------------------------------------------------------------------
    // Step 1: Alice sends an encrypted photo to Bob
    // -------------------------------------------------------------------------
    const photoAttachment = {
      attachmentId: 'att_photo_alice_1',
      objectId: 'obj_r2_photo_1',
      name: 'mountain_landscape.jpg',
      sizeBytes: 154000,
      mimeType: 'image/jpeg',
      ciphertextHash: 'hash_photo_1',
      encryptionKeyBase64: 'key_photo_1',
      allowSave: true,
      allowForward: true,
    };

    const alicePhotoWire = await alice.manager.encryptAndPackWireMessage(
      alice.session,
      bob.bundle,
      'Check out this mountain view!',
      photoAttachment
    );

    // -------------------------------------------------------------------------
    // Step 2: Bob receives and processes the photo message
    // -------------------------------------------------------------------------
    const bobReceivedPhoto = await bob.manager.processInboundWirePayload(
      bob.session,
      alicePhotoWire.wirePayloadBase64
    );

    expect(bobReceivedPhoto.storedMessage.text).toBe('Check out this mountain view!');
    expect(bobReceivedPhoto.attachment?.objectId).toBe('obj_r2_photo_1');
    const photoMsgId = bobReceivedPhoto.storedMessage.messageId;

    // Bob stores the message in UI store
    const bobUIMessagePhoto: UIMessage = {
      id: photoMsgId,
      conversationId: 'alice_conv',
      senderId: 'alice_id',
      senderName: 'Alice',
      text: 'Check out this mountain view!',
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: bobReceivedPhoto.attachment,
    };

    // -------------------------------------------------------------------------
    // Step 3: Bob replies to Alice's photo with text
    // -------------------------------------------------------------------------
    const bobReplyRef = resolveReplyReference(bobUIMessagePhoto);
    expect(bobReplyRef).toBeDefined();
    expect(bobReplyRef?.messageId).toBe(photoMsgId);
    expect(bobReplyRef?.senderName).toBe('Alice');

    // Bob sends reply to Alice
    const bobReplyWire = await bob.manager.encryptAndPackWireMessage(
      bob.session,
      alice.bundle,
      'That mountain view is breathtaking!',
      undefined,
      bobReplyRef
    );

    // -------------------------------------------------------------------------
    // Step 4: Alice receives Bob's reply quoting her photo
    // -------------------------------------------------------------------------
    const aliceReceivedReply = await alice.manager.processInboundWirePayload(
      alice.session,
      bobReplyWire.wirePayloadBase64
    );

    expect(aliceReceivedReply.storedMessage.text).toBe('That mountain view is breathtaking!');
    expect(aliceReceivedReply.replyTo).toBeDefined();
    expect(aliceReceivedReply.replyTo.messageId).toBe(photoMsgId);
    expect(aliceReceivedReply.replyTo.senderName).toBe('Alice');

    const aliceUIMessageReply: UIMessage = {
      id: aliceReceivedReply.storedMessage.messageId,
      conversationId: 'bob_conv',
      senderId: 'bob_id',
      senderName: 'Bob',
      text: aliceReceivedReply.storedMessage.text,
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_RECIPIENT',
      replyTo: aliceReceivedReply.replyTo,
    };

    // -------------------------------------------------------------------------
    // Step 5: Alice replies to Bob's reply with a video
    // -------------------------------------------------------------------------
    const aliceSecondReplyRef = resolveReplyReference(aliceUIMessageReply);
    expect(aliceSecondReplyRef?.messageId).toBe(aliceReceivedReply.storedMessage.messageId);
    expect(aliceSecondReplyRef?.text).toBe('That mountain view is breathtaking!');

    const videoAttachment = {
      attachmentId: 'att_video_alice_2',
      objectId: 'obj_r2_video_2',
      name: 'hike_trail.mp4',
      sizeBytes: 850000,
      mimeType: 'video/mp4',
      ciphertextHash: 'hash_video_2',
      encryptionKeyBase64: 'key_video_2',
      allowSave: true,
      allowForward: false,
    };

    const aliceVideoWire = await alice.manager.encryptAndPackWireMessage(
      alice.session,
      bob.bundle,
      'Here is the hike trail video',
      videoAttachment,
      aliceSecondReplyRef
    );

    // -------------------------------------------------------------------------
    // Step 6: Bob receives Alice's video reply
    // -------------------------------------------------------------------------
    const bobReceivedVideo = await bob.manager.processInboundWirePayload(
      bob.session,
      aliceVideoWire.wirePayloadBase64
    );

    expect(bobReceivedVideo.storedMessage.text).toBe('Here is the hike trail video');
    expect(bobReceivedVideo.attachment?.objectId).toBe('obj_r2_video_2');
    expect(bobReceivedVideo.replyTo).toBeDefined();
    expect(bobReceivedVideo.replyTo.messageId).toBe(aliceReceivedReply.storedMessage.messageId);
    expect(bobReceivedVideo.replyTo.text).toBe('That mountain view is breathtaking!');

    // -------------------------------------------------------------------------
    // Step 7: Encrypted Store Persistence & Rehydration Simulation
    // -------------------------------------------------------------------------
    const bobMessages: UIMessage[] = [
      bobUIMessagePhoto,
      {
        id: aliceReceivedReply.storedMessage.messageId,
        conversationId: 'alice_conv',
        senderId: 'bob_id',
        senderName: 'Bob',
        text: 'That mountain view is breathtaking!',
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'DELIVERED_TO_RECIPIENT',
        replyTo: bobReplyRef,
      },
      {
        id: bobReceivedVideo.storedMessage.messageId,
        conversationId: 'alice_conv',
        senderId: 'alice_id',
        senderName: 'Alice',
        text: 'Here is the hike trail video',
        isOutgoing: false,
        timestamp: Date.now(),
        status: 'DELIVERED_TO_RECIPIENT',
        attachment: bobReceivedVideo.attachment,
        replyTo: bobReceivedVideo.replyTo,
      },
    ];

    bob.store.set(bob.session, 'veil:ui:messages', { alice_conv: bobMessages });

    // Simulate app restart / unlock
    const rehydrated = bob.store.get<Record<string, UIMessage[]>>(bob.session, 'veil:ui:messages');
    expect(rehydrated).toBeDefined();
    expect(rehydrated!['alice_conv']).toHaveLength(3);

    const rehydratedVideoMsg = rehydrated!['alice_conv'][2];
    expect(rehydratedVideoMsg.attachment?.name).toBe('hike_trail.mp4');
    expect(rehydratedVideoMsg.replyTo?.messageId).toBe(aliceReceivedReply.storedMessage.messageId);
    expect(rehydratedVideoMsg.replyTo?.text).toBe('That mountain view is breathtaking!');
  });
});
