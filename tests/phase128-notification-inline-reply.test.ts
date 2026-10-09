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
    expect(plugin).toContain('override fun load()');
    expect(plugin).toContain('acceptReplyIntent(activity.intent)');
    expect(plugin).toContain('acceptReplyIntent(intent)');
    expect(appState).toContain("addNotificationReplyListener");
    expect(appState).toContain('sendMessage(reply.conversationId, text)');
    expect(dispatcher).toContain('clearNativeNotifications');
    expect(plugin).toContain('NotificationManagerCompat.from(context).cancelAll()');
  });

  it('uses VEIL’s current accent color for native notifications', () => {
    const bridge = read('src/notifications/nativeNotificationBridge.ts');
    const dispatcher = read('src/notifications/notificationDispatcher.ts');
    const plugin = read('android/app/src/main/java/chat/veil/app/VeilNotificationsPlugin.kt');

    expect(bridge).toContain('accentColor?: string');
    expect(dispatcher).toContain("getPropertyValue('--veil-accent-primary')");
    expect(dispatcher).toContain('...(accentColor ? { accentColor } : {})');
    expect(plugin).toContain('call.getString("accentColor")');
    expect(plugin).toContain('setColor(notificationColor)');
  });

  it('keeps background FCM notifications generic and lock-screen private', () => {
    const fcm = read('android/app/src/main/java/chat/veil/app/VeilFirebaseMessagingService.kt');
    expect(fcm).toContain('.setContentText("New encrypted message received")');
    expect(fcm).toContain('NotificationCompat.VISIBILITY_PRIVATE');
    expect(fcm).not.toContain('RemoteInput');
  });
});
