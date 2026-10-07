import { Capacitor, registerPlugin } from '@capacitor/core';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

interface NativeNotificationResult {
  status: NotificationPermissionStatus;
}

interface VeilNotificationsPlugin {
  checkPermission(): Promise<NativeNotificationResult>;
  requestPermission(): Promise<NativeNotificationResult>;
  show(options: { id: string; title: string; body: string }): Promise<void>;
  openSettings(): Promise<void>;
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
}): Promise<void> => {
  await nativeNotifications.show(payload);
};
