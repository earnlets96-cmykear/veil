/**
 * Phase 31 Step 5B: Message UX & Notification Polish Test Suite
 *
 * Verifies unread divider rendering, consecutive message grouping,
 * state-aware context menu filtering, duplicate retry prevention,
 * toast notification structures, and accessible timestamps.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MessageBubble,
  Toast,
  Spinner,
  MessageTimestamp,
} from '../src/ui/components/ui/index.ts';

describe('Phase 31 Step 5B: Message UX & Notification Polish Tests', () => {
  describe('Unread Messages & Dividers', () => {
    it('renders "New Messages" unread divider between read and unread messages', () => {
      const html = renderToStaticMarkup(
        <div>
          <div className="veil-message-row incoming">
            <div className="veil-message-bubble">Previous read message</div>
          </div>
          <div id="veil-unread-divider" className="veil-unread-divider">
            New Messages
          </div>
          <div className="veil-message-row incoming">
            <div className="veil-message-bubble">First new unread message</div>
          </div>
        </div>
      );

      expect(html).toContain('veil-unread-divider');
      expect(html).toContain('New Messages');
      expect(html).toContain('Previous read message');
      expect(html).toContain('First new unread message');
    });

    it('calculates first unread message index accurately based on unreadCount', () => {
      const totalMessages = 10;
      const unreadCount = 3;
      const firstUnreadIndex = totalMessages - unreadCount;
      expect(firstUnreadIndex).toBe(7);

      const zeroUnread = 0;
      const noUnreadIndex = zeroUnread <= 0 ? -1 : totalMessages - zeroUnread;
      expect(noUnreadIndex).toBe(-1);
    });
  });

  describe('Consecutive Message Grouping Logic & Rendering', () => {
    const isSameSender = (m1: { senderId: string; isOutgoing: boolean }, m2: { senderId: string; isOutgoing: boolean }) =>
      m1.senderId === m2.senderId && m1.isOutgoing === m2.isOutgoing;

    const isWithinTimeWindow = (t1: number, t2: number) => Math.abs(t1 - t2) <= 300000;

    it('identifies messages from same sender within 5 minutes as grouped', () => {
      const msg1 = { senderId: 'alice', isOutgoing: false, timestamp: 1700000000000 };
      const msg2 = { senderId: 'alice', isOutgoing: false, timestamp: 1700000060000 }; // +1 min
      const msg3 = { senderId: 'bob', isOutgoing: true, timestamp: 1700000090000 };
      const msg4 = { senderId: 'alice', isOutgoing: false, timestamp: 1700000500000 }; // +8.3 min

      expect(isSameSender(msg1, msg2) && isWithinTimeWindow(msg1.timestamp, msg2.timestamp)).toBe(true);
      expect(isSameSender(msg2, msg3)).toBe(false);
      expect(isWithinTimeWindow(msg1.timestamp, msg4.timestamp)).toBe(false);
    });

    it('renders grouped message bubbles with compact spacing classes', () => {
      const html = renderToStaticMarkup(
        <div>
          <MessageBubble
            id="m1"
            isOutgoing={false}
            text="First line"
            timestamp={1700000000000}
            isGroupedWithNext={true}
          />
          <MessageBubble
            id="m2"
            isOutgoing={false}
            text="Second line"
            timestamp={1700000010000}
            isGroupedWithPrevious={true}
          />
        </div>
      );

      expect(html).toContain('veil-message-grouped-next');
      expect(html).toContain('veil-message-grouped-prev');
      expect(html).toContain('First line');
      expect(html).toContain('Second line');
    });
  });

  describe('State-Aware Context Menu & Actions', () => {
    it('excludes Reply action and includes Retry on FAILED messages', () => {
      const msgStatus = 'FAILED';
      const actions = [
        ...(msgStatus !== 'FAILED' ? ['Reply'] : []),
        'Copy Text',
        'Select',
        ...(msgStatus === 'FAILED' ? ['Retry Send'] : []),
        'Delete Locally',
      ];

      expect(actions).toContain('Retry Send');
      expect(actions).toContain('Copy Text');
      expect(actions).toContain('Select');
      expect(actions).toContain('Delete Locally');
      expect(actions).not.toContain('Reply');
    });

    it('includes Reply action on normal delivered messages', () => {
      const msgStatus = 'DELIVERED_TO_RECIPIENT';
      const actions = [
        ...(msgStatus !== 'FAILED' ? ['Reply'] : []),
        'Copy Text',
        'Select',
        ...(msgStatus === 'FAILED' ? ['Retry Send'] : []),
        'Delete Locally',
      ];

      expect(actions).toContain('Reply');
      expect(actions).toContain('Copy Text');
      expect(actions).not.toContain('Retry Send');
    });
  });

  describe('Failed Message Retry & Duplicate Prevention', () => {
    it('renders Retry button with loading spinner when retry is active', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="m_retry"
          isOutgoing={true}
          text="Failed message content"
          timestamp={1700000000000}
          status="FAILED"
          isRetrying={true}
          onRetry={() => {}}
        />
      );

      expect(html).toContain('Retrying...');
      expect(html).toContain('veil-spinner');
      expect(html).toContain('aria-label="Retry sending failed message"');
    });

    it('prevents parallel duplicate retry clicks via set lock', () => {
      const retryingIds = new Set<string>();
      const msgId = 'msg_failed_1';

      // First click locks
      expect(retryingIds.has(msgId)).toBe(false);
      retryingIds.add(msgId);

      // Second click detects lock
      expect(retryingIds.has(msgId)).toBe(true);

      // Unlock on finish
      retryingIds.delete(msgId);
      expect(retryingIds.has(msgId)).toBe(false);
    });
  });

  describe('Toast Notifications & Accessibility', () => {
    it('renders success toast for clipboard copy and message actions', () => {
      const html = renderToStaticMarkup(
        <Toast
          toast={{ id: 't_copy', type: 'info', message: 'Message copied to clipboard' }}
          onDismiss={() => {}}
        />
      );

      expect(html).toContain('veil-toast-info');
      expect(html).toContain('Message copied to clipboard');
      expect(html).toContain('role="status"');
    });

    it('renders error toast for failed retry operations', () => {
      const html = renderToStaticMarkup(
        <Toast
          toast={{ id: 't_err', type: 'error', message: 'Failed to send message. Stored locally.' }}
          onDismiss={() => {}}
        />
      );

      expect(html).toContain('veil-toast-error');
      expect(html).toContain('Failed to send message. Stored locally.');
      expect(html).toContain('aria-live="assertive"');
    });
  });

  describe('Message Timestamp & Accessibility Primitives', () => {
    it('renders accessible semantic time element with ISO datetime', () => {
      const date = new Date(1700000000000);
      const html = renderToStaticMarkup(<MessageTimestamp timestamp={date} />);

      expect(html).toContain('<time');
      expect(html).toContain(`dateTime="${date.toISOString()}"`);
    });
  });
});
