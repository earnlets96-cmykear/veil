import { describe, expect, it } from 'vitest';
import { resolveReplyReference, UIMessage } from '../src/ui/app/AppState.tsx';
import { toWireReplyReference, assertWireSafe } from '../src/attachments/types.ts';

describe('Phase 45E: End-to-End Reply Serialization & Rehydration', () => {
  it('1. serializes text reply reference with senderName, text snippet, and messageId', () => {
    const originalMsg: UIMessage = {
      id: 'msg_orig_1',
      conversationId: 'conv_1',
      senderId: 'alice_id',
      senderName: 'Alice',
      text: 'Hello from encryption test!',
      isOutgoing: false,
      timestamp: Date.now() - 5000,
      status: 'DELIVERED_TO_RECIPIENT',
    };

    const replyRef = resolveReplyReference(originalMsg);
    expect(replyRef).toEqual({
      messageId: 'msg_orig_1',
      senderName: 'Alice',
      text: 'Hello from encryption test!',
      attachmentType: undefined,
    });

    const wireReply = toWireReplyReference(replyRef);
    expect(wireReply?.messageId).toBe('msg_orig_1');
    expect(wireReply?.senderName).toBe('Alice');
    expect(wireReply?.text).toBe('Hello from encryption test!');
    assertWireSafe(wireReply, 'wireReply');
  });

  it('2. serializes media and video reply references accurately', () => {
    const videoMsg: UIMessage = {
      id: 'msg_vid_1',
      conversationId: 'conv_1',
      senderId: 'bob_id',
      senderName: 'Bob',
      text: '',
      isOutgoing: true,
      timestamp: Date.now() - 2000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: {
        attachmentId: 'att_v1',
        name: 'vacation.mp4',
        sizeBytes: 45000,
        mimeType: 'video/mp4',
        previewUrl: 'blob:mock-vid-preview',
        localPreviewUrl: 'blob:mock-vid-preview',
      } as any,
    };

    const replyRef = resolveReplyReference(videoMsg);
    expect(replyRef?.messageId).toBe('msg_vid_1');
    expect(replyRef?.senderName).toBe('Bob');
    expect(replyRef?.attachmentType).toBe('video');
    expect(replyRef?.text).toBe('Video');

    const wireReply = toWireReplyReference(replyRef);
    expect((wireReply as any)?.previewUrl).toBeUndefined();
    expect((wireReply as any)?.localPreviewUrl).toBeUndefined();
    assertWireSafe(wireReply, 'wireReply');
  });

  it('3. serializes voice note reply references accurately', () => {
    const voiceMsg: UIMessage = {
      id: 'msg_voice_1',
      conversationId: 'conv_1',
      senderId: 'alice_id',
      senderName: 'Alice',
      text: 'Voice Message',
      isOutgoing: false,
      timestamp: Date.now() - 1000,
      status: 'DELIVERED_TO_RECIPIENT',
      voice: {
        durationSeconds: 12,
        sizeBytes: 15000,
        objectId: 'obj_voice_99',
        mimeType: 'audio/webm',
        ciphertextHash: 'hash_v',
        encryptionKeyBase64: 'key_v',
        nonceBase64: 'nonce_v',
      },
    };

    const replyRef = resolveReplyReference(voiceMsg);
    expect(replyRef?.messageId).toBe('msg_voice_1');
    expect(replyRef?.senderName).toBe('Alice');
    expect(replyRef?.attachmentType).toBe('voice');
    expect(replyRef?.text).toBe('Voice note');
  });

  it('4. serializes grouped-media gallery reply references accurately', () => {
    const galleryMsg: UIMessage = {
      id: 'msg_group_1',
      conversationId: 'conv_1',
      senderId: 'bob_id',
      senderName: 'Bob',
      text: '',
      isOutgoing: true,
      timestamp: Date.now() - 3000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachments: [
        { attachmentId: 'a1', name: 'p1.jpg', sizeBytes: 100, mimeType: 'image/jpeg' },
        { attachmentId: 'a2', name: 'p2.jpg', sizeBytes: 200, mimeType: 'image/jpeg' },
        { attachmentId: 'a3', name: 'p3.jpg', sizeBytes: 300, mimeType: 'image/jpeg' },
      ] as any,
    };

    const replyRef = resolveReplyReference(galleryMsg);
    expect(replyRef?.messageId).toBe('msg_group_1');
    expect(replyRef?.attachmentType).toBe('grouped');
    expect(replyRef?.text).toBe('3 Media Files');
  });
});
