/**
 * Notification Privacy Manager for VEIL Phase 7.
 *
 * Implements privacy-preserving notification generation across
 * High, Balanced, and Convenient tiers, with automatic notification clearing on lock.
 */

import { PrivacySettings, PrivacyNotification, NotificationPrivacy } from './types.ts';
import type { SpaceSession } from '../spaces/session.ts';

export class NotificationManager {
  private activeNotifications = new Map<string, PrivacyNotification[]>(); // spaceId -> notifications

  /**
   * Formats a notification payload respecting Space lock state and privacy settings.
   */
  public formatNotification(
    session: SpaceSession | null,
    spaceId: string,
    senderName: string,
    messageContent: string,
    hasMediaAttachment = false,
    settings?: PrivacySettings
  ): PrivacyNotification {
    const isUnlocked = session !== null && session.isActive() && session.spaceId === spaceId;

    // If Space is locked, ALWAYS return generic high-privacy notification
    if (!isUnlocked) {
      const lockedNotification: PrivacyNotification = {
        spaceId,
        title: 'VEIL',
        body: 'New message',
        showSender: false,
        showContent: false,
        showMediaPreview: false,
        timestamp: Date.now(),
      };
      this.recordNotification(spaceId, lockedNotification);
      return lockedNotification;
    }

    const privacyTier = settings?.notificationPrivacy ?? 'balanced';

    let notification: PrivacyNotification;

    switch (privacyTier) {
      case 'high':
        notification = {
          spaceId,
          title: 'VEIL',
          body: hasMediaAttachment ? 'New attachment' : 'New message',
          showSender: false,
          showContent: false,
          showMediaPreview: false,
          timestamp: Date.now(),
        };
        break;

      case 'balanced':
        notification = {
          spaceId,
          title: settings?.hideSenderNames ? 'VEIL' : senderName,
          body: settings?.hideMessagePreviews
            ? (hasMediaAttachment ? 'Attachment received' : 'Message received')
            : (hasMediaAttachment ? 'Sent an attachment' : 'Sent a message'),
          showSender: !settings?.hideSenderNames,
          showContent: false,
          showMediaPreview: false,
          timestamp: Date.now(),
        };
        break;

      case 'convenient':
      default:
        notification = {
          spaceId,
          title: settings?.hideSenderNames ? 'VEIL' : senderName,
          body: settings?.hideMessagePreviews
            ? 'New message'
            : (hasMediaAttachment ? `[Attachment] ${messageContent}` : messageContent),
          showSender: !settings?.hideSenderNames,
          showContent: !settings?.hideMessagePreviews,
          showMediaPreview: !settings?.hideMediaPreviews && hasMediaAttachment,
          timestamp: Date.now(),
        };
        break;
    }

    this.recordNotification(spaceId, notification);
    return notification;
  }

  /**
   * Records a notification into active state.
   */
  private recordNotification(spaceId: string, notification: PrivacyNotification): void {
    if (!this.activeNotifications.has(spaceId)) {
      this.activeNotifications.set(spaceId, []);
    }
    this.activeNotifications.get(spaceId)!.push(notification);
  }

  /**
   * Clears all notifications for a Space when it is locked.
   */
  public clearNotifications(spaceId: string): void {
    this.activeNotifications.delete(spaceId);
  }

  /**
   * Clears all notifications across all Spaces (for Panic Lock).
   */
  public clearAllNotifications(): void {
    this.activeNotifications.clear();
  }

  /**
   * Returns active notifications for a Space.
   */
  public getActiveNotifications(spaceId: string): PrivacyNotification[] {
    return this.activeNotifications.get(spaceId) ?? [];
  }
}
