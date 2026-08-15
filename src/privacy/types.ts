/**
 * Privacy UX Types for VEIL Phase 7.
 *
 * Defines privacy levels, lock states, notification privacy tiers,
 * auto-lock intervals, and UI state tracking structures.
 */

/** Privacy level presets */
export type PrivacyLevel = 'high' | 'balanced' | 'convenient';

/** Auto-lock interval options */
export type AutoLockInterval = 'off' | '1min' | '5min' | '15min' | '30min' | 'on_background';

/** Auto-lock interval durations in milliseconds (0 = disabled) */
export const AUTO_LOCK_DURATIONS: Record<AutoLockInterval, number> = {
  off: 0,
  '1min': 60_000,
  '5min': 300_000,
  '15min': 900_000,
  '30min': 1_800_000,
  on_background: -1, // Special: lock on app background event
};

/** Notification privacy tiers */
export type NotificationPrivacy = 'high' | 'balanced' | 'convenient';

/** Per-Space privacy settings */
export interface PrivacySettings {
  privacyLevel: PrivacyLevel;
  autoLockInterval: AutoLockInterval;
  notificationPrivacy: NotificationPrivacy;
  hideMessagePreviews: boolean;
  hideSenderNames: boolean;
  hideMediaPreviews: boolean;
  blurSensitiveContent: boolean;
  screenshotProtection: boolean;
}

/** Lock state of a Space */
export type LockState = 'UNLOCKED' | 'LOCKED' | 'PANIC_LOCKED';

/** Tracked sensitive UI content types */
export type SensitiveContentType =
  | 'message'
  | 'media_preview'
  | 'contact'
  | 'search_result'
  | 'draft'
  | 'clipboard'
  | 'group_name'
  | 'notification';

/** A tracked piece of sensitive content in the UI */
export interface SensitiveContentEntry {
  contentId: string;
  spaceId: string;
  type: SensitiveContentType;
  registeredAt: number;
}

/** Notification payload formatted for privacy */
export interface PrivacyNotification {
  spaceId: string;
  title: string;
  body: string;
  showSender: boolean;
  showContent: boolean;
  showMediaPreview: boolean;
  timestamp: number;
}

/** Human-readable conversation security status */
export type VerificationStatus = 'verified' | 'unverified' | 'security_changed';

/** Human-readable Space security summary */
export interface SpaceSecuritySummary {
  encrypted: true;
  recoveryStatus: 'configured' | 'not_configured';
  enrolledDevices: number;
  autoLock: string;
  privacyLevel: PrivacyLevel;
}

/** Identity change warning */
export interface IdentityChangeWarning {
  contactName: string;
  changeType: 'signing_key_changed' | 'key_agreement_changed' | 'full_identity_changed';
  previousFingerprint: string;
  newFingerprint: string;
  detectedAt: number;
  message: string;
}
