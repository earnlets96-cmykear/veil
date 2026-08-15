import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { NotificationManager } from '../src/privacy/notificationManager.ts';
import { PrivacyManager } from '../src/privacy/privacyManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 7: Notification Privacy Tests', () => {
  let vault: SpaceVaultManager;
  let notifMgr: NotificationManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    notifMgr = new NotificationManager();
  });

  it('NOTIFICATION PRIVACY: Respects High, Balanced, and Convenient tiers and locked state', () => {
    const header = vault.createSpace({ name: 'Main', password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = vault.unlockSpace('Pass!', header.spaceId);

    // 1. High Privacy tier
    const highSettings = PrivacyManager.getPreset('high');
    const notifHigh = notifMgr.formatNotification(
      sess,
      header.spaceId,
      'Bob',
      'Confidential secret project update',
      false,
      highSettings
    );

    expect(notifHigh.title).toBe('VEIL');
    expect(notifHigh.body).toBe('New message');
    expect(notifHigh.showSender).toBe(false);
    expect(notifHigh.showContent).toBe(false);

    // 2. Balanced tier (Default)
    const balancedSettings = PrivacyManager.getPreset('balanced');
    const notifBalanced = notifMgr.formatNotification(
      sess,
      header.spaceId,
      'Bob',
      'Confidential secret project update',
      false,
      balancedSettings
    );

    expect(notifBalanced.title).toBe('Bob');
    expect(notifBalanced.body).toBe('Sent a message');
    expect(notifBalanced.showSender).toBe(true);
    expect(notifBalanced.showContent).toBe(false);

    // 3. Convenient tier
    const convenientSettings = PrivacyManager.getPreset('convenient');
    const notifConvenient = notifMgr.formatNotification(
      sess,
      header.spaceId,
      'Bob',
      'Confidential secret project update',
      false,
      convenientSettings
    );

    expect(notifConvenient.title).toBe('Bob');
    expect(notifConvenient.body).toBe('Confidential secret project update');
    expect(notifConvenient.showContent).toBe(true);

    // 4. Locked Space -> ALWAYS returns High Privacy notification
    vault.lockSpace(header.spaceId);
    const notifLocked = notifMgr.formatNotification(
      null,
      header.spaceId,
      'Bob',
      'Confidential message while locked',
      false,
      convenientSettings
    );

    expect(notifLocked.title).toBe('VEIL');
    expect(notifLocked.body).toBe('New message');
    expect(notifLocked.showSender).toBe(false);
    expect(notifLocked.showContent).toBe(false);

    // 5. Clear notifications for locked Space
    notifMgr.clearNotifications(header.spaceId);
    expect(notifMgr.getActiveNotifications(header.spaceId)).toEqual([]);
  });
});
