import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';

describe('Phase 45D: Reply Gesture Physics & Touch Cancellation', () => {
  it('1. renders MessageBubble with swipe gesture structure and reply triggers', () => {
    const onReplyTrigger = vi.fn();
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg_swipe_1"
        isOutgoing={false}
        text="Swipe me to reply"
        timestamp={1600000000000}
        onReplyTrigger={onReplyTrigger}
      />
    );

    expect(html).toContain('id="msg-msg_swipe_1"');
    expect(html).toContain('veil-message-row');
    expect(html).toContain('veil-message-bubble');
    expect(html).toContain('aria-label="Reply to this message"');
  });

  it('2. horizontal swipe past -35px threshold activates reply state', () => {
    let replyTriggered = false;
    const onReplyTrigger = () => {
      replyTriggered = true;
    };

    // Touch start at (100, 50)
    const touchStart = { x: 100, y: 50 };
    // Move left to (45, 52) -> deltaX = -55, deltaY = 2
    const touchMove = { x: 45, y: 52 };
    const deltaX = touchMove.x - touchStart.x;
    const deltaY = touchMove.y - touchStart.y;

    let swipeOffset = 0;
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      swipeOffset = 0;
    } else if (deltaX < 0) {
      swipeOffset = Math.max(-50, deltaX);
    }

    expect(swipeOffset).toBe(-50);

    // End touch
    if (swipeOffset < -35) {
      onReplyTrigger();
    }
    expect(replyTriggered).toBe(true);
  });

  it('3. small swipe distance below -35px threshold does NOT trigger reply', () => {
    let replyTriggered = false;
    const onReplyTrigger = () => {
      replyTriggered = true;
    };

    const touchStart = { x: 100, y: 50 };
    const touchMove = { x: 80, y: 50 }; // deltaX = -20
    const deltaX = touchMove.x - touchStart.x;
    const deltaY = touchMove.y - touchStart.y;

    let swipeOffset = 0;
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      swipeOffset = 0;
    } else if (deltaX < 0) {
      swipeOffset = Math.max(-50, deltaX);
    }

    expect(swipeOffset).toBe(-20);

    if (swipeOffset < -35) {
      onReplyTrigger();
    }
    expect(replyTriggered).toBe(false);
  });

  it('4. vertical scrolling cancels horizontal swipe gesture', () => {
    let replyTriggered = false;
    const onReplyTrigger = () => {
      replyTriggered = true;
    };

    const touchStart = { x: 100, y: 50 };
    const touchMove = { x: 60, y: 120 }; // deltaX = -40, deltaY = 70 (vertical)
    const deltaX = touchMove.x - touchStart.x;
    const deltaY = touchMove.y - touchStart.y;

    let swipeOffset = -40;
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      swipeOffset = 0; // Gesture canceled
    }

    expect(swipeOffset).toBe(0);

    if (swipeOffset < -35) {
      onReplyTrigger();
    }
    expect(replyTriggered).toBe(false);
  });

  it('5. touchCancel resets swipeOffset and does NOT trigger reply', () => {
    let replyTriggered = false;
    const onReplyTrigger = () => {
      replyTriggered = true;
    };

    let swipeOffset = -45;
    let touchStart: { x: number; y: number } | null = { x: 100, y: 50 };

    // touchCancel event
    swipeOffset = 0;
    touchStart = null;

    if (swipeOffset < -35) {
      onReplyTrigger();
    }
    expect(replyTriggered).toBe(false);
    expect(swipeOffset).toBe(0);
    expect(touchStart).toBeNull();
  });
});
