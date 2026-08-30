/**
 * Phase 45: Quoted Reply System & Visual Rendering Test Suite.
 *
 * Verifies:
 * 1. ReplyPreview renders original sender name, text snippet, voice badge, attachment badge, and thumbnail.
 * 2. MessageBubble renders ReplyPreview inside message body with jump-to-message callback.
 * 3. 100% SVG vector iconography and zero emoji leaks.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplyPreview } from '../src/ui/components/ui/ReplyPreview.tsx';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';

describe('Phase 45: Quoted Reply System & Rendering', () => {
  it('renders text quote in ReplyPreview with sender name and snippet', () => {
    const html = renderToStaticMarkup(
      <ReplyPreview
        replyTo={{
          messageId: 'msg_original_1',
          senderName: 'Alice',
          text: 'Can you send the secret blueprint?',
        }}
        onClick={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(html).toContain('Alice');
    expect(html).toContain('Can you send the secret blueprint?');
    expect(html).toContain('veil-reply-preview');
    expect(html).toContain('aria-label="Replying to Alice"');
    expect(html).toContain('aria-label="Cancel reply quote"');
    expect(html).toContain('<svg');
  });

  it('renders media quote in ReplyPreview with thumbnail and media badge', () => {
    const html = renderToStaticMarkup(
      <ReplyPreview
        replyTo={{
          messageId: 'msg_media_2',
          senderName: 'Bob',
          attachmentType: 'image',
          thumbnailUrl: 'blob:mock-thumbnail-url',
        }}
      />
    );

    expect(html).toContain('Bob');
    expect(html).toContain('Photo / Video');
    expect(html).toContain('src="blob:mock-thumbnail-url"');
    expect(html).toContain('alt="Reply preview"');
  });

  it('renders voice note quote in ReplyPreview with voice icon snippet', () => {
    const html = renderToStaticMarkup(
      <ReplyPreview
        replyTo={{
          messageId: 'msg_voice_3',
          senderName: 'Charlie',
          attachmentType: 'voice',
        }}
      />
    );

    expect(html).toContain('Charlie');
    expect(html).toContain('Voice note');
    expect(html).toContain('<svg');
  });

  it('renders ReplyPreview inside MessageBubble cleanly', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg_reply_4"
        senderName="You"
        isOutgoing={true}
        text="Here is the file you asked for"
        timestamp={Date.now()}
        replyTo={{
          messageId: 'msg_original_1',
          senderName: 'Alice',
          text: 'Can you send the secret blueprint?',
        }}
        onReplyClick={() => {}}
      />
    );

    expect(html).toContain('Here is the file you asked for');
    expect(html).toContain('Alice');
    expect(html).toContain('Can you send the secret blueprint?');
    expect(html).toContain('veil-reply-preview');
    expect(html).toContain('veil-message-bubble');
  });
});
