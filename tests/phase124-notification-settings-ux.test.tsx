import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '../src/ui/components/ui/Toast.tsx';

const mocks = vi.hoisted(() => ({
  app: {
    activeSession: { spaceId: 'space-a', name: 'Work Space' },
    closeModal: vi.fn(),
    openModal: vi.fn(),
    sessionController: {},
    panicLock: vi.fn(),
    idMgr: { loadIdentity: vi.fn(() => null) },
    store: {},
    notificationDispatcher: {
      getPrivacyMode: vi.fn(() => 'SENDER_ONLY'),
      setPrivacyMode: vi.fn(),
      dispatch: vi.fn(),
    },
    enableBackgroundPushNotifications: vi.fn(),
    disableBackgroundPushNotifications: vi.fn(),
    exportMyInvitation: vi.fn(),
    myProfile: null,
    privacySettings: {},
    updatePrivacySettings: vi.fn(),
    registerUsername: vi.fn(),
    lockSpace: vi.fn(),
    knownSpacesCount: 1,
    changeAccountPassword: vi.fn(),
    isMainAccount: false,
    verifyMainAccount: vi.fn(),
    updateProfileAvatar: vi.fn(),
    markFilePickerActive: vi.fn(),
    markFilePickerInactive: vi.fn(),
    backgroundPushStatus: 'off' as 'off' | 'registering' | 'ready' | 'error',
    backgroundPushError: null as string | null,
  },
  isAndroid: false,
}));

vi.mock('../src/ui/app/AppState.tsx', () => ({ useApp: () => mocks.app }));
vi.mock('../src/notifications/nativeNotificationBridge.ts', () => ({
  getNotificationPermissionStatus: vi.fn(async () => 'default'),
  isNativeNotificationPlatform: () => mocks.isAndroid,
  openNativeNotificationSettings: vi.fn(),
  requestNativeNotificationPermission: vi.fn(async () => 'granted'),
}));

import { SettingsModal } from '../src/ui/components/SettingsModal.tsx';

function renderSettings() {
  return renderToStaticMarkup(<ToastProvider><SettingsModal initialCategory="notifications" /></ToastProvider>);
}

describe('notification settings UX', () => {
  beforeEach(() => {
    mocks.isAndroid = false;
    mocks.app.backgroundPushStatus = 'off';
    mocks.app.backgroundPushError = null;
  });

  it('separates device permission from local notification privacy and keeps test disabled without permission', () => {
    const html = renderSettings();
    expect(html).toContain('Device permission');
    expect(html).toContain('While VEIL is open');
    expect(html).toContain('These choices control local alerts while VEIL is running');
    expect(html).toContain('Shows sender or group and a short plaintext message preview.');
    expect(html).toContain('Shows a generic “New encrypted message received” alert.');
    expect(html).toContain('Suppresses system notifications and turns off Android background alerts.');
    expect(html).toMatch(/disabled=""[^>]*><span>Send Test Notification/s);
    expect(html).not.toContain('Background alerts (Android)');
  });

  it('shows Android background registration status and explains generic one-Space delivery', () => {
    mocks.isAndroid = true;
    mocks.app.backgroundPushStatus = 'ready';
    const html = renderSettings();
    expect(html).toContain('Background alerts (Android)');
    expect(html).toContain('Background alerts are enabled for the active Space.');
    expect(html).toContain('Active Space: <strong>Work Space</strong>');
    expect(html).toContain('The alert stays generic.');
    expect(html).toContain('one Space at a time');
  });

  it('announces registration progress and safe retry errors without rendering a token', () => {
    mocks.isAndroid = true;
    mocks.app.backgroundPushStatus = 'registering';
    const pending = renderSettings();
    expect(pending).toContain('Registering alerts for the active Space');

    mocks.app.backgroundPushStatus = 'error';
    mocks.app.backgroundPushError = 'Could not register background alerts. Retry from Notifications settings.';
    const failed = renderSettings();
    expect(failed).toContain('role="status" aria-live="polite"');
    expect(failed).toContain('Retry from Notifications settings');
    expect(failed).not.toContain('fcm-token');
  });
});
