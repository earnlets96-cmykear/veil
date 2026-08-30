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

function makePeer(name: string, password: string) {
  const vault = new SpaceVaultManager();
  const envelope = vault.createSpace({ name, password, kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace(password, envelope.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const identities = new SpaceIdentityManager();
  const document = identities.createIdentity(session, store);
  const prekeys = new PrekeyManager(store, identities);
  prekeys.generateSignedPrekey(session);
  prekeys.generateOneTimePrekeys(session, 5);
  return {
    session,
    store,
    document,
    manager: new ConversationManager(store, identities, prekeys),
    bundle: prekeys.createPrekeyBundle(session),
  };
}

describe('Phase 45D: Reply Persistence and Serialization', () => {
  it('1. correctly derives ReplyReference for text messages', () => {
    const textMsg: UIMessage = {
      id: 'msg_orig_text_123',
      conversationId: 'peer_1',
      senderId: 'peer_1',
      senderName: 'Alice',
      text: 'Hello from Alice!',
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_RECIPIENT',
    };

    const replyRef = resolveReplyReference(textMsg);
    expect(replyRef).toBeDefined();
    expect(replyRef?.messageId).toBe('msg_orig_text_123');
    expect(replyRef?.senderName).toBe('Alice');
    expect(replyRef?.text).toBe('Hello from Alice!');
    expect(replyRef?.attachmentType).toBeUndefined();
  });

  it('2. correctly derives ReplyReference for photo and video attachments', () => {
    const photoMsg: UIMessage = {
      id: 'msg_photo_456',
      conversationId: 'peer_1',
      senderId: 'peer_1',
      senderName: 'Alice',
      text: '',
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: {
        attachmentId: 'att_photo_1',
        name: 'sunset.jpg',
        sizeBytes: 10240,
        mimeType: 'image/jpeg',
      },
    };

    const photoReply = resolveReplyReference(photoMsg);
    expect(photoReply?.messageId).toBe('msg_photo_456');
    expect(photoReply?.attachmentType).toBe('image');
    expect(photoReply?.text).toBe('Photo');

    const videoMsg: UIMessage = {
      id: 'msg_video_789',
      conversationId: 'peer_1',
      senderId: 'peer_1',
      senderName: 'Bob',
      text: 'Check this clip',
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: {
        attachmentId: 'att_video_1',
        name: 'demo.mp4',
        sizeBytes: 204800,
        mimeType: 'video/mp4',
      },
    };

    const videoReply = resolveReplyReference(videoMsg);
    expect(videoReply?.messageId).toBe('msg_video_789');
    expect(videoReply?.attachmentType).toBe('video');
    expect(videoReply?.text).toBe('Check this clip');
  });

  it('3. correctly derives ReplyReference for voice notes and grouped media', () => {
    const voiceMsg: UIMessage = {
      id: 'msg_voice_101',
      conversationId: 'peer_1',
      senderId: 'peer_1',
      senderName: 'Alice',
      text: 'Voice Message',
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_RECIPIENT',
      voice: {
        durationSeconds: 15,
        sizeBytes: 32000,
        objectId: 'obj_voice_1',
        mimeType: 'audio/webm',
        ciphertextHash: 'hash',
        encryptionKeyBase64: 'key',
        nonceBase64: 'nonce',
      },
    };

    const voiceReply = resolveReplyReference(voiceMsg);
    expect(voiceReply?.messageId).toBe('msg_voice_101');
    expect(voiceReply?.attachmentType).toBe('voice');
    expect(voiceReply?.text).toBe('Voice note');

    const groupedMsg: UIMessage = {
      id: 'msg_grouped_202',
      conversationId: 'peer_1',
      senderId: 'peer_1',
      senderName: 'Alice',
      text: '',
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'DELIVERED_TO_RECIPIENT',
      attachments: [
        { attachmentId: 'att_1', name: 'img1.png', sizeBytes: 5000, mimeType: 'image/png' },
        { attachmentId: 'att_2', name: 'img2.png', sizeBytes: 6000, mimeType: 'image/png' },
        { attachmentId: 'att_3', name: 'img3.png', sizeBytes: 7000, mimeType: 'image/png' },
      ],
    };

    const groupedReply = resolveReplyReference(groupedMsg);
    expect(groupedReply?.messageId).toBe('msg_grouped_202');
    expect(groupedReply?.attachmentType).toBe('grouped');
    expect(groupedReply?.text).toBe('3 Media Files');
  });

  it('4. serializes reply metadata across E2EE wire payload and rehydrates at recipient', async () => {
    const alice = makePeer('Alice', 'Alice-45D!');
    const bob = makePeer('Bob', 'Bob-45D!');

    const replyRef = {
      messageId: 'msg_orig_photo_999',
      senderName: 'Alice',
      text: 'Photo',
      attachmentType: 'image',
    };

    const outgoing = await alice.manager.encryptAndPackWireMessage(
      alice.session,
      bob.bundle,
      'Nice photo, Alice!',
      undefined,
      replyRef
    );

    const received = await bob.manager.processInboundWirePayload(bob.session, outgoing.wirePayloadBase64);

    expect(received.storedMessage.text).toBe('Nice photo, Alice!');
    expect(received.replyTo).toBeDefined();
    expect(received.replyTo.messageId).toBe('msg_orig_photo_999');
    expect(received.replyTo.senderName).toBe('Alice');
    expect(received.replyTo.text).toBe('Photo');
    expect(received.replyTo.attachmentType).toBe('image');
  });

  it('5. preserves reply metadata across encrypted store save and rehydration', () => {
    const alice = makePeer('Alice', 'Alice-45D-Store!');
    const replyRef = {
      messageId: 'msg_target_123',
      senderName: 'Bob',
      text: 'Original message text',
      attachmentType: undefined,
    };

    const msg: UIMessage = {
      id: 'msg_reply_456',
      conversationId: 'conv_bob',
      senderId: 'alice_id',
      text: 'My reply to Bob',
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'SENT_TO_RELAY',
      replyTo: replyRef,
    };

    const storeState: Record<string, UIMessage[]> = {
      conv_bob: [msg],
    };

    alice.store.set(alice.session, 'veil:ui:messages', storeState);

    const rehydrated = alice.store.get<Record<string, UIMessage[]>>(alice.session, 'veil:ui:messages');
    expect(rehydrated).toBeDefined();
    expect(rehydrated!['conv_bob']).toHaveLength(1);
    const loadedMsg = rehydrated!['conv_bob'][0];
    expect(loadedMsg.id).toBe('msg_reply_456');
    expect(loadedMsg.replyTo).toEqual(replyRef);
    expect(loadedMsg.replyTo?.messageId).toBe('msg_target_123');
  });
});
