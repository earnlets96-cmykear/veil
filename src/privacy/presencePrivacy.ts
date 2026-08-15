/**
 * Presence & Interaction Privacy Controls for VEIL Phase 8.
 *
 * Implements privacy controls for typing indicators, read receipts,
 * and online presence with rate-limiting to prevent keystroke timing leakage.
 */

export type LastSeenPolicy = 'nobody' | 'contacts' | 'disabled';

export interface PresencePrivacySettings {
  typingIndicatorsEnabled: boolean;
  readReceiptsEnabled: boolean;
  lastSeenPolicy: LastSeenPolicy;
}

export interface InteractionReceipt {
  receiptId: string;
  targetMessageId: string;
  type: 'delivered' | 'read';
  timestamp: number;
}

export class PresencePrivacyManager {
  private settings: PresencePrivacySettings;
  private lastTypingEmit = new Map<string, number>(); // conversationId -> timestamp
  private static readonly MIN_TYPING_INTERVAL_MS = 3000; // 3-second rate limit to prevent keystroke analysis

  constructor(initialSettings?: Partial<PresencePrivacySettings>) {
    this.settings = {
      typingIndicatorsEnabled: initialSettings?.typingIndicatorsEnabled ?? false,
      readReceiptsEnabled: initialSettings?.readReceiptsEnabled ?? false,
      lastSeenPolicy: initialSettings?.lastSeenPolicy ?? 'nobody',
    };
  }

  public getSettings(): PresencePrivacySettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<PresencePrivacySettings>): PresencePrivacySettings {
    this.settings = { ...this.settings, ...updates };
    return { ...this.settings };
  }

  /**
   * Determines whether a typing indicator event should be emitted.
   * Rate limits events to prevent timing inference of active keystrokes.
   */
  public shouldEmitTyping(conversationId: string, now = Date.now()): boolean {
    if (!this.settings.typingIndicatorsEnabled) {
      return false;
    }

    const last = this.lastTypingEmit.get(conversationId) ?? 0;
    if (now - last < PresencePrivacyManager.MIN_TYPING_INTERVAL_MS) {
      return false;
    }

    this.lastTypingEmit.set(conversationId, now);
    return true;
  }

  /**
   * Creates a read receipt if enabled in privacy settings.
   */
  public createReadReceipt(messageId: string): InteractionReceipt | null {
    if (!this.settings.readReceiptsEnabled) {
      return null;
    }

    return {
      receiptId: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetMessageId: messageId,
      type: 'read',
      timestamp: Date.now(),
    };
  }

  /**
   * Formats a last-seen status respecting the active privacy policy.
   */
  public formatLastSeen(isContact: boolean, lastActiveTimestamp?: number): string | null {
    if (this.settings.lastSeenPolicy === 'nobody' || this.settings.lastSeenPolicy === 'disabled' || !lastActiveTimestamp) {
      return null;
    }

    if (this.settings.lastSeenPolicy === 'contacts' && !isContact) {
      return null;
    }

    const diffMinutes = Math.floor((Date.now() - lastActiveTimestamp) / 60000);
    if (diffMinutes < 5) return 'Recently online';
    if (diffMinutes < 60) return `Online ${diffMinutes}m ago`;
    return 'Offline';
  }
}
