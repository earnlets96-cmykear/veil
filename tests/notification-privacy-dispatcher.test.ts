import { describe, it, expect } from 'vitest';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';

describe('VEIL Phase 15: Notification Privacy Dispatcher Tests', () => {
  it('PRIVACY POLICIES: Formats notification according to selected privacy policy', () => {
    const dispatcher = new NotificationDispatcher('SENDER_ONLY');

    const event = {
      id: 'n1',
      senderName: 'Alice',
      text: 'Confidential message content',
      timestamp: Date.now(),
    };

    // SENDER_ONLY
    const n1 = dispatcher.prepareNotification(event);
    expect(n1?.title).toBe('VEIL');
    expect(n1?.body).toBe('New message from Alice');
    expect(n1?.body).not.toContain('Confidential');

    // HIDDEN
    dispatcher.setPrivacyMode('HIDDEN');
    const n2 = dispatcher.prepareNotification(event);
    expect(n2?.title).toBe('VEIL');
    expect(n2?.body).toBe('New encrypted message received');

    // FULL_OBFUSCATED
    dispatcher.setPrivacyMode('FULL_OBFUSCATED');
    const n3 = dispatcher.prepareNotification(event);
    expect(n3?.title).toBe('Alice');
    expect(n3?.body).toContain('Confidential message');
  });

  it('LOCKED SPACE SUPPRESSION: Suppresses all notifications when Space is locked', () => {
    const dispatcher = new NotificationDispatcher('SENDER_ONLY');
    dispatcher.setLocked(true);

    const event = {
      id: 'n2',
      senderName: 'Bob',
      text: 'Hello',
      timestamp: Date.now(),
    };

    const notif = dispatcher.prepareNotification(event);
    expect(notif).toBeNull();
  });
});
