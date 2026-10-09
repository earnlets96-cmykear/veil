import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Phase 128: private Android notification reply', () => {
  it('routes local notification replies through the active encrypted conversation', () => {
    const bridge = read('src/notifications/nativeNotificationBridge.ts');
    const dispatcher = read('src/notifications/notificationDispatcher.ts');
    const plugin = read('android/app/src/main/java/chat/veil/app/VeilNotificationsPlugin.kt');
    const appState = read('src/ui/app/AppState.tsx');

    expect(bridge).toContain('conversationId?: string');
    expect(dispatcher).toContain('conversationId: event.conversationId');
    expect(plugin).toContain('RemoteInput');
    expect(plugin).toContain('notifyListeners(');
    expect(plugin).toContain('"reply",');
    expect(plugin).toContain('NotificationCompat.Action');
    expect(appState).toContain("addNotificationReplyListener");
    expect(appState).toContain('sendMessage(reply.conversationId, text)');
    expect(dispatcher).toContain('clearNativeNotifications');
    expect(plugin).toContain('NotificationManagerCompat.from(context).cancelAll()');
  });

  it('keeps background FCM notifications generic and lock-screen private', () => {
    const fcm = read('android/app/src/main/java/chat/veil/app/VeilFirebaseMessagingService.kt');
    expect(fcm).toContain('.setContentText("New encrypted message received")');
    expect(fcm).toContain('NotificationCompat.VISIBILITY_PRIVATE');
    expect(fcm).not.toContain('RemoteInput');
  });
});
