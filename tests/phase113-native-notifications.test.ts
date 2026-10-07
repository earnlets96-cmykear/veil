import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Phase 113: Android notification delivery', () => {
  it('routes native notification delivery through the Capacitor bridge', () => {
    const dispatcher = read('src/notifications/notificationDispatcher.ts');
    const bridge = read('src/notifications/nativeNotificationBridge.ts');
    expect(dispatcher).toContain('showNativeNotification');
    expect(dispatcher).toContain('isNativeNotificationPlatform');
    expect(bridge).toContain("registerPlugin<VeilNotificationsPlugin>('VeilNotifications')");
    expect(bridge).toContain('requestPermission');
  });

  it('registers a native notification plugin and creates a notification channel', () => {
    const activity = read('android/app/src/main/java/chat/veil/app/MainActivity.java');
    const plugin = read('android/app/src/main/java/chat/veil/app/VeilNotificationsPlugin.kt');
    expect(activity).toContain('registerPlugin(VeilNotificationsPlugin.class)');
    expect(plugin).toContain('name = "VeilNotifications"');
    expect(plugin).toContain('NotificationChannel');
    expect(plugin).toContain('requestPermissionForAlias("notifications"');
    expect(plugin).toContain('NotificationManagerCompat.from(context).notify');
  });

  it('exposes notification permission controls and a safe test notification in settings', () => {
    const settings = read('src/ui/components/SettingsModal.tsx');
    expect(settings).toContain('requestNativeNotificationPermission');
    expect(settings).toContain('Send Test Notification');
    expect(settings).toContain('notificationDispatcher?.setPrivacyMode(mode)');
  });
});
