/**
 * Phase 40: Reply System, Swipe Gestures & Jump-to-Message Test Suite.
 *
 * Verifies:
 * - MessageBubble renders compact quoted reply reference
 * - Quoted reply preview shows sender name and preview text
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';

describe('Phase 40: Reply System & Quoted References', () => {
  it('renders quoted reply preview and text inside MessageBubble', () => {
    const handleReplyClick = vi.fn();

    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg_reply_1"
        isOutgoing={false}
        senderName="Alice"
        text="I am replying to you"
        timestamp={Date.now()}
        replyTo={{
          messageId: 'msg_original_42',
          senderName: 'Bob',
          text: 'Original message question?',
        }}
        onReplyClick={handleReplyClick}
      />
    );

    expect(html).toContain('Original message question?');
    expect(html).toContain('I am replying to you');
    expect(html).toContain('Bob');
    expect(html).toContain('veil-reply-preview');
  });
});
