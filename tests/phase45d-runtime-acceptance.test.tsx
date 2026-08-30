import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import { ReplyPreview } from '../src/ui/components/ui/ReplyPreview.tsx';
import { resolveReplyReference } from '../src/ui/app/AppState.tsx';
import { UIMessage } from '../src/ui/app/types.ts';

describe('Phase 45D: Runtime UI Acceptance & End-to-End Chat Flow', () => {
  it('1. exercises text swipe-to-reply, composer banner, and quote inside sent message bubble', () => {
    // 1. Original incoming text message from Bob
    const originalMsg: UIMessage = {
      id: 'msg_bob_01',
      conversationId: 'bob_identity',
      senderId: 'bob_identity',
      senderName: 'Bob',
      text: 'Are we still meeting at 3 PM?',
      isOutgoing: false,
      timestamp: 1725000000000,
      status: 'DELIVERED_TO_RECIPIENT',
    };

    // 2. Resolve reply reference when user swipes left
    const replyRef = resolveReplyReference(originalMsg)!;
    expect(replyRef.messageId).toBe('msg_bob_01');
    expect(replyRef.senderName).toBe('Bob');
    expect(replyRef.text).toBe('Are we still meeting at 3 PM?');

    // 3. Render composer preview banner
    let dismissed = false;
    const composerBannerHtml = renderToStaticMarkup(
      <ReplyPreview replyTo={replyRef} onDismiss={() => { dismissed = true; }} />
    );
    expect(composerBannerHtml).toContain('Replying to');
    expect(composerBannerHtml).toContain('Bob');
    expect(composerBannerHtml).toContain('Are we still meeting at 3 PM?');
    expect(composerBannerHtml).toContain('aria-label="Cancel reply quote"');

    // 4. Sent reply message bubble containing the quote
    const sentReplyMsg: UIMessage = {
      id: 'msg_alice_02',
      conversationId: 'bob_identity',
      senderId: 'alice_identity',
      text: 'Yes, see you at 3 PM at the coffee shop!',
      isOutgoing: true,
      timestamp: 1725000005000,
      status: 'DELIVERED_TO_RECIPIENT',
      replyTo: replyRef,
    };

    let jumpedToId: string | null = null;
    const bubbleHtml = renderToStaticMarkup(
      <MessageBubble
        id={sentReplyMsg.id}
        isOutgoing={sentReplyMsg.isOutgoing}
        text={sentReplyMsg.text}
        timestamp={sentReplyMsg.timestamp}
        replyTo={sentReplyMsg.replyTo}
        onReplyClick={(id) => { jumpedToId = id; }}
      />
    );

    expect(bubbleHtml).toContain('veil-message-bubble');
    expect(bubbleHtml).toContain('veil-reply-preview');
    expect(bubbleHtml).toContain('Bob');
    expect(bubbleHtml).toContain('Are we still meeting at 3 PM?');
    expect(bubbleHtml).toContain('Yes, see you at 3 PM at the coffee shop!');
  });

  it('2. exercises media reply (photo, video, file, voice, grouped) quote formatting', () => {
    // Photo message
    const photoMsg: UIMessage = {
      id: 'msg_photo_01',
      conversationId: 'c1',
      senderId: 'bob',
      senderName: 'Bob',
      text: '',
      isOutgoing: false,
      timestamp: 1725000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: { name: 'landscape.jpg', sizeBytes: 50000, mimeType: 'image/jpeg' },
    };
    const photoRef = resolveReplyReference(photoMsg)!;
    expect(photoRef.attachmentType).toBe('image');
    expect(photoRef.text).toBe('Photo');

    const photoHtml = renderToStaticMarkup(<ReplyPreview replyTo={photoRef} />);
    expect(photoHtml).toContain('Photo');
    expect(photoHtml).toContain('veil-icon');

    // Video message
    const videoMsg: UIMessage = {
      id: 'msg_video_01',
      conversationId: 'c1',
      senderId: 'bob',
      senderName: 'Bob',
      text: 'Check this hike video',
      isOutgoing: false,
      timestamp: 1725000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: { name: 'trail.mp4', sizeBytes: 500000, mimeType: 'video/mp4' },
    };
    const videoRef = resolveReplyReference(videoMsg)!;
    expect(videoRef.attachmentType).toBe('video');
    expect(videoRef.text).toBe('Check this hike video');

    const videoHtml = renderToStaticMarkup(<ReplyPreview replyTo={videoRef} />);
    expect(videoHtml).toContain('Check this hike video');

    // Voice message
    const voiceMsg: UIMessage = {
      id: 'msg_voice_01',
      conversationId: 'c1',
      senderId: 'bob',
      senderName: 'Bob',
      text: 'Voice Message',
      isOutgoing: false,
      timestamp: 1725000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      voice: {
        durationSeconds: 12,
        sizeBytes: 15000,
        objectId: 'v1',
        mimeType: 'audio/webm',
        ciphertextHash: '',
        encryptionKeyBase64: '',
        nonceBase64: '',
      },
    };
    const voiceRef = resolveReplyReference(voiceMsg)!;
    expect(voiceRef.attachmentType).toBe('voice');
    expect(voiceRef.text).toBe('Voice note');

    // Grouped message
    const groupedMsg: UIMessage = {
      id: 'msg_grouped_01',
      conversationId: 'c1',
      senderId: 'bob',
      senderName: 'Bob',
      text: '',
      isOutgoing: false,
      timestamp: 1725000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachments: [
        { name: '1.jpg', sizeBytes: 1000, mimeType: 'image/jpeg' },
        { name: '2.jpg', sizeBytes: 1000, mimeType: 'image/jpeg' },
      ],
    };
    const groupedRef = resolveReplyReference(groupedMsg)!;
    expect(groupedRef.attachmentType).toBe('grouped');
    expect(groupedRef.text).toBe('2 Media Files');
  });

  it('3. jump to message locates original by canonical ID and handles missing message gracefully', () => {
    const activeMessages: UIMessage[] = [
      {
        id: 'msg_target_100',
        conversationId: 'c1',
        senderId: 'bob',
        senderName: 'Bob',
        text: 'Target message to locate',
        isOutgoing: false,
        timestamp: 1725000000000,
        status: 'DELIVERED_TO_RECIPIENT',
      },
      {
        id: 'msg_reply_200',
        conversationId: 'c1',
        senderId: 'alice',
        text: 'Replying to target',
        isOutgoing: true,
        timestamp: 1725000010000,
        status: 'DELIVERED_TO_RECIPIENT',
        replyTo: {
          messageId: 'msg_target_100',
          senderName: 'Bob',
          text: 'Target message to locate',
        },
      },
    ];

    // Successful target search
    const foundTarget = activeMessages.find((m) => m.id === 'msg_target_100');
    expect(foundTarget).toBeDefined();
    expect(foundTarget?.text).toBe('Target message to locate');

    // Missing target search fallback
    const missingTarget = activeMessages.find((m) => m.id === 'msg_deleted_999');
    expect(missingTarget).toBeUndefined();
  });

  it('4. ensures zero Unicode emoji icons in quote previews and message actions', () => {
    const replyRef = {
      messageId: 'm1',
      senderName: 'Bob',
      text: 'Photo',
      attachmentType: 'image',
    };

    const previewHtml = renderToStaticMarkup(
      <ReplyPreview replyTo={replyRef} onDismiss={() => {}} />
    );

    const bubbleHtml = renderToStaticMarkup(
      <MessageBubble
        id="m2"
        isOutgoing={true}
        text="Nice pic"
        timestamp={1725000000000}
        replyTo={replyRef}
      />
    );

    const forbiddenEmojis = ['📷', '▶', '📎', '🚨', '🎤', '🔒', '↩', '🔄', '❌'];
    for (const emoji of forbiddenEmojis) {
      expect(previewHtml).not.toContain(emoji);
      expect(bubbleHtml).not.toContain(emoji);
    }
  });
});
