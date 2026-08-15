/**
 * Notification Privacy Types for VEIL.
 */

export type NotificationPrivacyMode = 'HIDDEN' | 'SENDER_ONLY' | 'FULL_OBFUSCATED';

export interface NotificationEvent {
  id: string;
  senderName: string;
  text?: string;
  isGroup?: boolean;
  groupName?: string;
  timestamp: number;
}
