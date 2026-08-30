import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplyPreview } from '../src/ui/components/ui/ReplyPreview.tsx';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import { resolveReplyReference } from '../src/ui/app/AppState.tsx';
import { UIMessage } from '../src/ui/app/types.ts';

describe('Phase 45D: Media Reply UI & Action Support', () => {
  it('1. renders Photo reply quote with SVG ImageIcon', () => {
    const photoMsg: UIMessage = {
      id: 'photo_100',
      conversationId: 'conv_1',
      senderId: 'peer_1',
      senderName: 'Alice',
      text: '',
      isOutgoing: false,
      timestamp: 1600000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: {
        name: 'portrait.png',
        sizeBytes: 10000,
        mimeType: 'image/png',
      },
    };

    const replyRef = resolveReplyReference(photoMsg)!;
    const html = renderToStaticMarkup(
      <ReplyPreview replyTo={replyRef} onDismiss={() => {}} />
    );

    expect(html).toContain('Alice');
    expect(html).toContain('Photo');
    expect(html).toContain('veil-icon'); // SVG icon rendered
    expect(html).toContain('aria-label="Cancel reply quote"');
  });

  it('2. renders Video reply quote with SVG VideoIcon', () => {
    const videoMsg: UIMessage = {
      id: 'video_200',
      conversationId: 'conv_1',
      senderId: 'peer_1',
      senderName: 'Bob',
      text: 'Check out the waves',
      isOutgoing: false,
      timestamp: 1600000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: {
        name: 'ocean.mp4',
        sizeBytes: 500000,
        mimeType: 'video/mp4',
      },
    };

    const replyRef = resolveReplyReference(videoMsg)!;
    const html = renderToStaticMarkup(
      <ReplyPreview replyTo={replyRef} />
    );

    expect(html).toContain('Bob');
    expect(html).toContain('Check out the waves');
    expect(html).toContain('veil-icon');
  });

  it('3. renders File reply quote with SVG PaperclipIcon', () => {
    const fileMsg: UIMessage = {
      id: 'file_300',
      conversationId: 'conv_1',
      senderId: 'peer_1',
      senderName: 'Charlie',
      text: 'Attachment: audit_report.pdf',
      isOutgoing: false,
      timestamp: 1600000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachment: {
        name: 'audit_report.pdf',
        sizeBytes: 25000,
        mimeType: 'application/pdf',
      },
    };

    const replyRef = resolveReplyReference(fileMsg)!;
    const html = renderToStaticMarkup(
      <ReplyPreview replyTo={replyRef} />
    );

    expect(html).toContain('Charlie');
    expect(html).toContain('audit_report.pdf');
    expect(html).toContain('veil-icon');
  });

  it('4. renders Voice message reply quote with SVG MicIcon', () => {
    const voiceMsg: UIMessage = {
      id: 'voice_400',
      conversationId: 'conv_1',
      senderId: 'peer_1',
      senderName: 'Diana',
      text: 'Voice Message',
      isOutgoing: false,
      timestamp: 1600000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      voice: {
        durationSeconds: 30,
        sizeBytes: 40000,
        objectId: 'obj_voice',
        mimeType: 'audio/webm',
        ciphertextHash: 'h',
        encryptionKeyBase64: 'k',
        nonceBase64: 'n',
      },
    };

    const replyRef = resolveReplyReference(voiceMsg)!;
    const html = renderToStaticMarkup(
      <ReplyPreview replyTo={replyRef} />
    );

    expect(html).toContain('Diana');
    expect(html).toContain('Voice note');
    expect(html).toContain('veil-icon');
  });

  it('5. renders Grouped Media reply quote with media count summary', () => {
    const groupedMsg: UIMessage = {
      id: 'grouped_500',
      conversationId: 'conv_1',
      senderId: 'peer_1',
      senderName: 'Eve',
      text: '3 Media Files',
      isOutgoing: false,
      timestamp: 1600000000000,
      status: 'DELIVERED_TO_RECIPIENT',
      attachments: [
        { attachmentId: '1', name: 'p1.jpg', sizeBytes: 1000, mimeType: 'image/jpeg' },
        { attachmentId: '2', name: 'p2.jpg', sizeBytes: 1000, mimeType: 'image/jpeg' },
        { attachmentId: '3', name: 'p3.jpg', sizeBytes: 1000, mimeType: 'image/jpeg' },
      ],
    };

    const replyRef = resolveReplyReference(groupedMsg)!;
    const html = renderToStaticMarkup(
      <ReplyPreview replyTo={replyRef} />
    );

    expect(html).toContain('Eve');
    expect(html).toContain('3 Media Files');
    expect(html).toContain('veil-icon');
  });

  it('6. renders Reply quote inside MessageBubble component', () => {
    const replyRef = {
      messageId: 'orig_123',
      senderName: 'Alice',
      text: 'Photo',
      attachmentType: 'image',
    };

    const html = renderToStaticMarkup(
      <MessageBubble
        id="reply_msg_1"
        isOutgoing={true}
        text="That photo looks amazing!"
        timestamp={1600000000000}
        replyTo={replyRef}
      />
    );

    expect(html).toContain('veil-reply-preview');
    expect(html).toContain('Alice');
    expect(html).toContain('Photo');
    expect(html).toContain('That photo looks amazing!');
    expect(html).toContain('veil-message-meta');
  });
});
