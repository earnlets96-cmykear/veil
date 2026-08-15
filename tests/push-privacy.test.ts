import { describe, it, expect } from 'vitest';
import { NotificationManager } from '../src/privacy/notificationManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 8: Push Notification Metadata Privacy Tests', () => {
  it('PUSH PRIVACY: Push payloads never expose Space names or plaintext data', () => {
    const notifMgr = new NotificationManager();
    const vault = new SpaceVaultManager();

    const header = vault.createSpace({ name: 'Classified Operations', password: 'SecretPassword!', kdfParams: FAST_TEST_KDF_PARAMS });

    // When Space is locked (standard state when receiving push):
    const pushNotification = notifMgr.formatNotification(
      null, // locked
      header.spaceId,
      'Alice Secret Agent',
      'Meet at location Delta at midnight'
    );

    // Payload inspection
    expect(pushNotification.title).toBe('VEIL');
    expect(pushNotification.body).toBe('New message');
    expect(pushNotification.body).not.toContain('Classified Operations');
    expect(pushNotification.body).not.toContain('Alice');
    expect(pushNotification.body).not.toContain('location Delta');
    expect(pushNotification.showSender).toBe(false);
    expect(pushNotification.showContent).toBe(false);
  });
});
