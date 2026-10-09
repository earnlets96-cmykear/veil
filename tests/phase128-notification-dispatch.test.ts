import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  show: vi.fn(),
  clear: vi.fn(async () => {}),
}));

vi.mock('../src/notifications/nativeNotificationBridge.ts', () => ({
  getNotificationPermissionStatus: vi.fn(async () => 'granted'),
  isNativeNotificationPlatform: vi.fn(() => true),
  showNativeNotification: native.show,
  clearNativeNotifications: native.clear,
}));

import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';

describe('Phase 128: notification reply privacy gates', () => {
  beforeEach(() => {
    native.show.mockReset();
    native.clear.mockReset();
    vi.stubGlobal('document', { visibilityState: 'visible' });
  });

  it('adds the inline reply route only for Full Preview notifications', async () => {
    const dispatcher = new NotificationDispatcher('FULL_OBFUSCATED');
    const event = {
      id: 'message-1',
      conversationId: 'conversation-1',
      spaceId: 'space-1',
      senderName: 'Alice',
      text: 'A private message',
      timestamp: 1,
    };

    await dispatcher.dispatch(event);

    expect(native.show).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Alice',
      body: 'A private message',
      conversationId: 'conversation-1',
      spaceId: 'space-1',
      allowReply: true,
    }));

    dispatcher.setPrivacyMode('SENDER_ONLY');
    await dispatcher.dispatch({ ...event, id: 'message-2' });
    expect(native.show).toHaveBeenLastCalledWith(expect.not.objectContaining({ allowReply: true }));
  });

  it('suppresses and clears active notifications when the Space locks', async () => {
    const dispatcher = new NotificationDispatcher('FULL_OBFUSCATED');
    dispatcher.setLocked(true);

    expect(native.clear).toHaveBeenCalledOnce();
    await expect(dispatcher.dispatch({
      id: 'message-locked',
      senderName: 'Alice',
      text: 'Private text',
      timestamp: 1,
    })).resolves.toBe(false);
    expect(native.show).not.toHaveBeenCalled();
  });
});
