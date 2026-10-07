import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeBridge = vi.hoisted(() => ({
  isNativeNotificationPlatform: vi.fn(),
  getNotificationPermissionStatus: vi.fn(),
  showNativeNotification: vi.fn(),
}));

vi.mock('../src/notifications/nativeNotificationBridge.ts', () => nativeBridge);

import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';

describe('Android push notification deduplication', () => {
  beforeEach(() => {
    nativeBridge.isNativeNotificationPlatform.mockReturnValue(true);
    nativeBridge.getNotificationPermissionStatus.mockResolvedValue('granted');
    nativeBridge.showNativeNotification.mockReset();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { visibilityState: 'hidden' },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => 'true' },
    });
  });

  it('defers local alerts while Android is hidden and remote push is enabled', async () => {
    const dispatcher = new NotificationDispatcher('SENDER_ONLY');
    const delivered = await dispatcher.dispatch({ id: 'm1', senderName: 'Sam', text: 'hello', timestamp: 1 });

    expect(delivered).toBe(false);
    expect(nativeBridge.showNativeNotification).not.toHaveBeenCalled();
  });

  it('still dispatches locally while VEIL is visible', async () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { visibilityState: 'visible' },
    });
    const dispatcher = new NotificationDispatcher('SENDER_ONLY');
    const delivered = await dispatcher.dispatch({ id: 'm2', senderName: 'Sam', text: 'hello', timestamp: 2 });

    expect(delivered).toBe(true);
    expect(nativeBridge.showNativeNotification).toHaveBeenCalledTimes(1);
  });
});
