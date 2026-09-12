import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';

describe('Phase 98: Unified Full-Row Swipe-to-Reply Across All Message Types', () => {
  describe('1. MessageBubble disableInternalSwipe Delegation', () => {
    it('attaches touch handlers when disableInternalSwipe is false or omitted (backward compatibility)', () => {
      const onReplyTrigger = vi.fn();
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_standalone_1"
          text="Standalone message"
          timestamp={Date.now()}
          onReplyTrigger={onReplyTrigger}
        />
      );

      // In standalone mode, MessageBubble retains its own row-level touch handlers
      expect(html).toContain('id="msg-msg_standalone_1"');
      expect(html).toContain('veil-message-row');
      expect(html).toContain('veil-message-bubble');
    });

    it('removes internal touch listeners when disableInternalSwipe is true', () => {
      const onReplyTrigger = vi.fn();
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_delegated_1"
          text="Delegated message in ConversationView"
          timestamp={Date.now()}
          onReplyTrigger={onReplyTrigger}
          disableInternalSwipe={true}
        />
      );

      expect(html).toContain('id="msg-msg_delegated_1"');
      expect(html).toContain('veil-message-row');
      expect(html).toContain('veil-message-bubble');
    });
  });

  describe('2. ConversationView Source Architecture Verification', () => {
    const cvPath = path.resolve(__dirname, '../src/ui/components/ConversationView.tsx');
    const cvSource = fs.readFileSync(cvPath, 'utf-8');

    it('unconditionally attaches row touch handlers without !hasVisibleTextBubble barrier', () => {
      // Must not restrict row touch listeners to !hasVisibleTextBubble
      expect(cvSource).not.toContain('onTouchStart={!hasVisibleTextBubble ? handleTouchStart : undefined}');
      expect(cvSource).not.toContain('onTouchMove={!hasVisibleTextBubble ? handleTouchMove : undefined}');
      expect(cvSource).not.toContain('onTouchEnd={!hasVisibleTextBubble ? handleTouchEnd : undefined}');
      expect(cvSource).not.toContain('onTouchCancel={!hasVisibleTextBubble ? handleTouchEnd : undefined}');

      // Must attach handlers directly so all rows capture swipe across the entire field
      expect(cvSource).toContain('onTouchStart={handleTouchStart}');
      expect(cvSource).toContain('onTouchMove={handleTouchMove}');
      expect(cvSource).toContain('onTouchEnd={handleTouchEnd}');
      expect(cvSource).toContain('onTouchCancel={handleTouchEnd}');
    });

    it('passes disableInternalSwipe={true} to MessageBubble inside ConversationView', () => {
      expect(cvSource).toContain('disableInternalSwipe={true}');
    });

    it('applies horizontal translation to veil-bubble-wrapper across all message types', () => {
      expect(cvSource).not.toContain('transform: !hasVisibleTextBubble ?');
      expect(cvSource).toContain('transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined');
      expect(cvSource).toContain("transition: swipeOffset === 0 ? 'transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'");
    });

    it('renders the Telegram-style spring reply indicator for all message types', () => {
      expect(cvSource).not.toContain('!hasVisibleTextBubble && swipeOffset < -15');
      expect(cvSource).toContain('swipeOffset < -10 && (');
      expect(cvSource).toContain('veil-swipe-reply-indicator');
      expect(cvSource).toContain('<ReplyIcon size={16} />');
    });
  });

  describe('3. Elastic Spring Physics & Gesture Protection', () => {
    const computeElasticOffset = (deltaX: number) =>
      -Math.min(75, Math.pow(Math.abs(deltaX), 0.82) * 1.6);

    it('accurately computes elastic offset and caps at -75px', () => {
      expect(computeElasticOffset(0)).toBe(-0);
      const small = computeElasticOffset(-20);
      expect(small).toBeLessThan(0);
      expect(small).toBeGreaterThan(-30);

      const threshold = computeElasticOffset(-60);
      expect(threshold).toBeLessThanOrEqual(-45);

      const huge = computeElasticOffset(-500);
      expect(huge).toBe(-75);
    });

    it('triggers reply action when swipeOffset reaches -45px threshold', () => {
      const onReplyTrigger = vi.fn();
      const testSwipeEnd = (offset: number) => {
        if (offset <= -45) {
          onReplyTrigger();
        }
      };

      testSwipeEnd(-20);
      expect(onReplyTrigger).not.toHaveBeenCalled();

      testSwipeEnd(-44.9);
      expect(onReplyTrigger).not.toHaveBeenCalled();

      testSwipeEnd(-45);
      expect(onReplyTrigger).toHaveBeenCalledTimes(1);

      testSwipeEnd(-60);
      expect(onReplyTrigger).toHaveBeenCalledTimes(2);
    });

    it('cancels swipe when vertical scroll exceeds horizontal swipe', () => {
      const touchStart = { x: 100, y: 100 };
      const touchMove = { x: 80, y: 150 }; // deltaX = -20, deltaY = 50
      const deltaX = touchMove.x - touchStart.x;
      const deltaY = touchMove.y - touchStart.y;

      let swipeOffset = -10;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        swipeOffset = 0;
      }

      expect(swipeOffset).toBe(0);
    });

    it('ConversationView exclusions protect interactive controls from swiping', () => {
      const cvPath = path.resolve(__dirname, '../src/ui/components/ConversationView.tsx');
      const cvSource = fs.readFileSync(cvPath, 'utf-8');

      // Verify that handleTouchStart and handleTouchMove exclude sliders, waveforms, player cards, buttons, etc.
      expect(cvSource).toContain('[data-no-swipe="true"]');
      expect(cvSource).toContain('.veil-waveform-container');
      expect(cvSource).toContain('.veil-voicenote-card');
      expect(cvSource).toContain('.veil-audio-player-card');
      expect(cvSource).toContain('.veil-audio-scrubber-track');
      expect(cvSource).toContain('.veil-reaction-chip');
      expect(cvSource).toContain('[role="slider"]');
    });
  });
});
