/**
 * Privacy-Preserving Notification Dispatcher for VEIL.
 *
 * Formats notification payloads according to Space privacy policy without
 * leaking plaintext to system notification logs or server payloads.
 */

import { NotificationEvent, NotificationPrivacyMode } from './types.ts';
import {
  getNotificationPermissionStatus,
  clearNativeNotifications,
  isNativeNotificationPlatform,
  showNativeNotification,
} from './nativeNotificationBridge.ts';

export class NotificationDispatcher {
  private privacyMode: NotificationPrivacyMode = 'SENDER_ONLY';
  private isLocked = false;
  private mutedConversations = new Set<string>();
  private browserNotifications = new Set<Notification>();

  constructor(initialMode: NotificationPrivacyMode = 'SENDER_ONLY') {
    this.privacyMode = this.readSavedPrivacyMode(initialMode);
  }

  private readSavedPrivacyMode(fallback: NotificationPrivacyMode): NotificationPrivacyMode {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('veil:notifications:privacy-mode') : null;
      if (saved === 'HIDDEN' || saved === 'SENDER_ONLY' || saved === 'FULL_OBFUSCATED' || saved === 'SILENT_COUNTER') {
        return saved;
      }
    } catch {}
    return fallback;
  }

  public setMutedConversations(mutedIds: string[] | Set<string>): void {
    this.mutedConversations = new Set(mutedIds);
  }

  public isConversationMuted(conversationId: string): boolean {
    return this.mutedConversations.has(conversationId);
  }

  public muteConversation(conversationId: string): void {
    this.mutedConversations.add(conversationId);
  }

  public unmuteConversation(conversationId: string): void {
    this.mutedConversations.delete(conversationId);
  }

  public setPrivacyMode(mode: NotificationPrivacyMode): void {
    if (this.privacyMode !== mode) this.clearActiveNotifications();
    this.privacyMode = mode;
  }

  public getPrivacyMode(): NotificationPrivacyMode {
    return this.privacyMode;
  }

  public setLocked(isLocked: boolean): void {
    this.isLocked = isLocked;
    if (isLocked) this.clearActiveNotifications();
  }

  /**
   * Formats and prepares a notification. Returns null if suppressed due to lock state or HIDDEN mode.
   */
  public prepareNotification(event: NotificationEvent): { title: string; body: string } | null {
    if (this.isLocked) {
      // Locked space suppresses all plaintext/sender notifications
      return null;
    }

    if (event.conversationId && this.mutedConversations.has(event.conversationId)) {
      // Suppressed because conversation is muted
      return null;
    }

    if (this.privacyMode === 'HIDDEN') {
      return {
        title: 'VEIL',
        body: 'New encrypted message received',
      };
    }

    if (this.privacyMode === 'SILENT_COUNTER') return null;

    if (this.privacyMode === 'SENDER_ONLY') {
      const source = event.isGroup ? `${event.groupName || 'Group'}` : event.senderName;
      return {
        title: 'VEIL',
        body: `New message from ${source}`,
      };
    }

    if (this.privacyMode === 'FULL_OBFUSCATED') {
      const source = event.isGroup ? `${event.groupName || 'Group'}` : event.senderName;
      const preview = event.text ? (event.text.length > 25 ? `${event.text.slice(0, 22)}...` : event.text) : 'Encrypted content';
      return {
        title: source,
        body: preview,
      };
    }

    return null;
  }

  /**
   * Dispatches through Android's native notification bridge or the browser API.
   */
  public async dispatch(event: NotificationEvent): Promise<boolean> {
    const payload = this.prepareNotification(event);
    if (!payload) return false;

    // When Android is backgrounded and remote push is enabled, let the native
    // Firebase service be the one alert. This avoids duplicate local + remote
    // notifications if the WebSocket happens to remain alive in the background.
    if (this.shouldDeferToBackgroundPush()) return false;

    if (isNativeNotificationPlatform()) {
      if (await getNotificationPermissionStatus() !== 'granted') return false;
      try {
        const accentColor = this.readAccentColor();
        await showNativeNotification({
          id: event.id,
          ...payload,
          ...(accentColor ? { accentColor } : {}),
          ...(this.privacyMode === 'FULL_OBFUSCATED' && event.conversationId && event.spaceId
            ? { conversationId: event.conversationId, spaceId: event.spaceId, allowReply: true }
            : {}),
        });
        return true;
      } catch {
        return false;
      }
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notification = new Notification(payload.title, {
          body: payload.body,
          icon: '/favicon.ico',
          silent: false,
        });
        this.browserNotifications.add(notification);
        notification.onclose = () => this.browserNotifications.delete(notification);
        return true;
      } catch (_e) {
        return false;
      }
    }
    return false;
  }

  private clearActiveNotifications(): void {
    for (const notification of this.browserNotifications) notification.close();
    this.browserNotifications.clear();
    void clearNativeNotifications().catch(() => {});
  }

  private readAccentColor(): string | undefined {
    try {
      if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return undefined;
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--veil-accent-primary')
        .trim();
      return /^#[0-9a-f]{6}$/i.test(accent) ? accent : undefined;
    } catch {
      return undefined;
    }
  }

  private shouldDeferToBackgroundPush(): boolean {
    if (!isNativeNotificationPlatform() || typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      return false;
    }
    try {
      return localStorage.getItem('veil:background-push-enabled') === 'true';
    } catch {
      return false;
    }
  }
}
