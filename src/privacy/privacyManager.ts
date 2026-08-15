/**
 * Per-Space Privacy Settings Manager for VEIL.
 *
 * Stores and retrieves privacy configuration per Space in EncryptedSpaceStore.
 * Each Space maintains independent privacy settings.
 */

import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import type { PrivacySettings, PrivacyLevel } from './types.ts';

const PRIVACY_SETTINGS_KEY = 'veil:privacy:settings';

/** Privacy presets for each level */
const PRIVACY_PRESETS: Record<PrivacyLevel, PrivacySettings> = {
  high: {
    privacyLevel: 'high',
    autoLockInterval: '1min',
    notificationPrivacy: 'high',
    hideMessagePreviews: true,
    hideSenderNames: true,
    hideMediaPreviews: true,
    blurSensitiveContent: true,
    screenshotProtection: true,
  },
  balanced: {
    privacyLevel: 'balanced',
    autoLockInterval: '5min',
    notificationPrivacy: 'balanced',
    hideMessagePreviews: false,
    hideSenderNames: false,
    hideMediaPreviews: false,
    blurSensitiveContent: false,
    screenshotProtection: false,
  },
  convenient: {
    privacyLevel: 'convenient',
    autoLockInterval: '30min',
    notificationPrivacy: 'convenient',
    hideMessagePreviews: false,
    hideSenderNames: false,
    hideMediaPreviews: false,
    blurSensitiveContent: false,
    screenshotProtection: false,
  },
};

export class PrivacyManager {
  private store: EncryptedSpaceStore;

  constructor(store: EncryptedSpaceStore) {
    this.store = store;
  }

  /**
   * Returns default privacy settings (balanced preset).
   */
  public static getDefaultSettings(): PrivacySettings {
    return { ...PRIVACY_PRESETS.balanced };
  }

  /**
   * Returns the privacy preset for a given level.
   */
  public static getPreset(level: PrivacyLevel): PrivacySettings {
    return { ...PRIVACY_PRESETS[level] };
  }

  /**
   * Gets privacy settings for the active Space.
   * Returns defaults if none have been configured.
   */
  public getSettings(session: SpaceSession): PrivacySettings {
    this.assertSession(session);
    const stored = this.store.get<PrivacySettings>(session, PRIVACY_SETTINGS_KEY);
    return stored ?? PrivacyManager.getDefaultSettings();
  }

  /**
   * Updates privacy settings for the active Space.
   * Merges partial updates with current settings.
   */
  public updateSettings(session: SpaceSession, updates: Partial<PrivacySettings>): PrivacySettings {
    this.assertSession(session);
    const current = this.getSettings(session);
    const updated: PrivacySettings = { ...current, ...updates };

    // If privacy level changed, apply preset defaults for the new level
    if (updates.privacyLevel && updates.privacyLevel !== current.privacyLevel) {
      const preset = PrivacyManager.getPreset(updates.privacyLevel);
      // Apply preset but allow explicit overrides from updates
      Object.assign(updated, preset, updates);
    }

    this.store.set(session, PRIVACY_SETTINGS_KEY, updated);
    return updated;
  }

  /**
   * Resets privacy settings to defaults.
   */
  public resetToDefaults(session: SpaceSession): PrivacySettings {
    this.assertSession(session);
    const defaults = PrivacyManager.getDefaultSettings();
    this.store.set(session, PRIVACY_SETTINGS_KEY, defaults);
    return defaults;
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('PrivacyManager rejected: Space session is locked or destroyed');
    }
  }
}
