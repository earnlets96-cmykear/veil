import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

interface NativeNotificationResult {
  status: NotificationPermissionStatus;
}

export interface NotificationReply {
  conversationId: string;
  spaceId: string;
  text: string;
}

interface VeilNotificationsPlugin {
  checkPermission(): Promise<NativeNotificationResult>;
  requestPermission(): Promise<NativeNotificationResult>;
  show(options: { id: string; title: string; body: string; conversationId?: string; spaceId?: string; allowReply?: boolean; accentColor?: string }): Promise<void>;
  clearAll(): Promise<void>;
  addListener(eventName: 'reply', listener: (reply: NotificationReply) => void): Promise<PluginListenerHandle>;
  openSettings(): Promise<void>;
  registerForPush(): Promise<{ token: string }>;
  deletePushToken(): Promise<void>;
}

const nativeNotifications = registerPlugin<VeilNotificationsPlugin>('VeilNotifications');

export const isNativeNotificationPlatform = (): boolean => Capacitor.getPlatform() === 'android';

export const getNotificationPermissionStatus = async (): Promise<NotificationPermissionStatus> => {
  if (isNativeNotificationPlatform()) {
    try {
      return (await nativeNotifications.checkPermission()).status;
    } catch {
      return 'unsupported';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
};

export const requestNativeNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
  if (isNativeNotificationPlatform()) {
    try {
      return (await nativeNotifications.requestPermission()).status;
    } catch {
      return 'unsupported';
    }
  }
  if (typeof Notification === 'undefined' || !Notification.requestPermission) return 'unsupported';
  return Notification.requestPermission();
};

export const openNativeNotificationSettings = async (): Promise<void> => {
  if (isNativeNotificationPlatform()) await nativeNotifications.openSettings();
};

export const showNativeNotification = async (payload: {
  id: string;
  title: string;
  body: string;
  conversationId?: string;
  spaceId?: string;
  allowReply?: boolean;
  accentColor?: string;
}): Promise<void> => {
  await nativeNotifications.show(payload);
};

export const clearNativeNotifications = async (): Promise<void> => {
  if (isNativeNotificationPlatform()) await nativeNotifications.clearAll();
};

export const addNotificationReplyListener = (
  listener: (reply: NotificationReply) => void,
): Promise<PluginListenerHandle> => nativeNotifications.addListener('reply', listener);

export const registerForRemotePushToken = async (): Promise<string> => {
  if (!isNativeNotificationPlatform()) throw new Error('Background push is available only in the Android app');
  const result = await nativeNotifications.registerForPush();
  if (!result.token) throw new Error('Android push registration returned no token');
  return result.token;
};

export const deleteRemotePushToken = async (): Promise<void> => {
  if (isNativeNotificationPlatform()) await nativeNotifications.deletePushToken();
};
