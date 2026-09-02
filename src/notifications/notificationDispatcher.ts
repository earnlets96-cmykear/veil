/**
 * Privacy-Preserving Notification Dispatcher for VEIL.
 *
 * Formats notification payloads according to Space privacy policy without
 * leaking plaintext to system notification logs or server payloads.
 */

import { NotificationEvent, NotificationPrivacyMode } from './types.ts';

export class NotificationDispatcher {
  private privacyMode: NotificationPrivacyMode = 'SENDER_ONLY';
  private isLocked = false;
  private mutedConversations = new Set<string>();

  constructor(initialMode: NotificationPrivacyMode = 'SENDER_ONLY') {
    this.privacyMode = initialMode;
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
    this.privacyMode = mode;
  }

  public getPrivacyMode(): NotificationPrivacyMode {
    return this.privacyMode;
  }

  public setLocked(isLocked: boolean): void {
    this.isLocked = isLocked;
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
   * Dispatches via Web Notification API if permitted.
   */
  public dispatch(event: NotificationEvent): boolean {
    const payload = this.prepareNotification(event);
    if (!payload) return false;

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/favicon.ico',
          silent: false,
        });
        return true;
      } catch (_e) {
        return false;
      }
    }
    return false;
  }
}
