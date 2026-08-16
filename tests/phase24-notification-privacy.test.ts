import { describe, it, expect } from 'vitest';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';
import { NotificationEvent } from '../src/notifications/types.ts';

describe('VEIL Phase 24: Notification Privacy & Zero-Leakage Policy Tests', () => {
  it('enforces strict privacy policies across all notification modes and locked states', () => {
    const rawEvent: NotificationEvent = {
      id: 'msg_secret_123',
      senderName: 'Alice Secret',
      text: 'Highly confidential message body with private data',
      timestamp: Date.now(),
      isGroup: false,
    };

    // 1. SENDER_ONLY Mode
    const dispatcherSenderOnly = new NotificationDispatcher('SENDER_ONLY');
    const senderOnlyPayload = dispatcherSenderOnly.prepareNotification(rawEvent)!;
    expect(senderOnlyPayload.title).toBe('VEIL');
    expect(senderOnlyPayload.body).toBe('New message from Alice Secret');
    expect(senderOnlyPayload.body).not.toContain('Highly confidential');

    // 2. HIDDEN Mode
    const dispatcherHidden = new NotificationDispatcher('HIDDEN');
    const hiddenPayload = dispatcherHidden.prepareNotification(rawEvent)!;
    expect(hiddenPayload.title).toBe('VEIL');
    expect(hiddenPayload.body).toBe('New encrypted message received');
    expect(hiddenPayload.title).not.toContain('Alice');
    expect(hiddenPayload.body).not.toContain('confidential');

    // 3. Locked State Invariant: If Space is locked, ALWAYS suppresses notification
    dispatcherSenderOnly.setLocked(true);
    const lockedPayload = dispatcherSenderOnly.prepareNotification(rawEvent);
    expect(lockedPayload).toBeNull();
  });
});
