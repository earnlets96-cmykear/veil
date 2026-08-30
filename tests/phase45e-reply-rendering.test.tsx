import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import { ReplyPreview } from '../src/ui/components/ui/ReplyPreview.tsx';

describe('Phase 45E: Reply UI Rendering & Interaction Acceptance', () => {
  it('1. visibly renders reply quote preview with sender name and snippet inside outgoing MessageBubble', () => {
    const replyData = {
      messageId: 'msg_orig_123',
      senderName: 'Alice',
      text: 'Original message text that was replied to',
    };

    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg_out_1"
        senderName="Me"
        isOutgoing={true}
        text="My follow-up reply"
        timestamp={Date.now()}
        status="SENT_TO_RELAY"
        replyTo={replyData}
      />
    );

    expect(html).toContain('veil-reply-preview');
    expect(html).toContain('Alice');
    expect(html).toContain('Original message text that was replied to');
    expect(html).toContain('My follow-up reply');
    expect(html).toContain('veil-message-bubble outgoing');
  });

  it('2. visibly renders reply quote for media and voice notes with SVG iconography', () => {
    const voiceReplyData = {
      messageId: 'msg_voice_77',
      senderName: 'Bob',
      text: 'Voice note (0:15)',
      attachmentType: 'voice' as const,
    };

    const html = renderToStaticMarkup(
      <ReplyPreview replyTo={voiceReplyData} />
    );

    expect(html).toContain('Bob');
    expect(html).toContain('Voice note (0:15)');
    expect(html).toContain('svg'); // Vector icon rendered
  });

  it('3. gracefully renders reply quote even if senderName is omitted or original message is deleted', () => {
    const deletedReplyData = {
      messageId: 'msg_deleted_99',
      text: 'Original message unavailable',
    };

    const html = renderToStaticMarkup(
      <ReplyPreview replyTo={deletedReplyData} />
    );

    expect(html).toContain('Peer');
    expect(html).toContain('Original message unavailable');
  });
});
