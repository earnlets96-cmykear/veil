import { describe, it, expect } from 'vitest';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';

describe('VEIL Phase 17: Privacy Regression & Notification Policy Tests', () => {
  it('PRIVACY POLICY REGRESSION: Verifies locked state suppression and obfuscated formatting', () => {
    const dispatcher = new NotificationDispatcher('HIDDEN');

    const notif = dispatcher.prepareNotification({
      id: 'e1',
      senderName: 'Eve',
      text: 'Sensitive text that must not appear in OS notification center',
      timestamp: Date.now(),
    });

    expect(notif?.title).toBe('VEIL');
    expect(notif?.body).toBe('New encrypted message received');
    expect(notif?.body).not.toContain('Sensitive text');
    expect(notif?.body).not.toContain('Eve');

    // Locked state
    dispatcher.setLocked(true);
    const lockedNotif = dispatcher.prepareNotification({
      id: 'e2',
      senderName: 'Eve',
      text: 'Secret',
      timestamp: Date.now(),
    });
    expect(lockedNotif).toBeNull();
  });
});
