/**
 * Privacy-Preserving Presence & Activity Subsystem for VEIL.
 *
 * Implements:
 * - Local-first activity tracking with auto-decay (60s inactivity threshold).
 * - Fine-grained privacy enforcement ('nobody' | 'contacts' | 'everyone').
 * - Formatted status strings ('online', 'last seen recently', etc.) without leaking exact timestamps
 *   when privacy restrictions are enabled.
 * - Integration with browser/device visibility and focus lifecycle.
 */

export type PresenceVisibility = 'nobody' | 'contacts' | 'everyone';

export interface PeerPresenceState {
  identityId: string;
  isOnline: boolean;
  lastSeenTimestamp?: number;
}

export class PresenceManager {
  private lastActiveTimestamp: number = Date.now();
  private isLocallyActive: boolean = true;
  private peerPresenceMap: Map<string, PeerPresenceState> = new Map();
  private listeners: Set<() => void> = new Set();
  private heartbeatTimer: any = null;

  constructor() {
    this.setupActivityListeners();
  }

  private setupActivityListeners(): void {
    if (typeof window !== 'undefined') {
      const handleActivity = () => {
        this.recordActivity();
      };

      window.addEventListener('mousemove', handleActivity, { passive: true });
      window.addEventListener('keydown', handleActivity, { passive: true });
      window.addEventListener('touchstart', handleActivity, { passive: true });
      window.addEventListener('focus', handleActivity);

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.isLocallyActive = true;
            this.recordActivity();
          } else {
            this.isLocallyActive = false;
            this.notify();
          }
        });
      }
    }

    // Decay timer: marks inactive after 60s
    this.heartbeatTimer = setInterval(() => {
      const wasActive = this.isLocallyActive;
      const elapsed = Date.now() - this.lastActiveTimestamp;
      if (elapsed > 60000) {
        this.isLocallyActive = false;
      }
      if (wasActive !== this.isLocallyActive) {
        this.notify();
      }
    }, 15000);
  }

  public recordActivity(): void {
    this.lastActiveTimestamp = Date.now();
    const wasInactive = !this.isLocallyActive;
    this.isLocallyActive = true;
    if (wasInactive) {
      this.notify();
    }
  }

  public isSelfOnline(): boolean {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return false;
    }
    return this.isLocallyActive && (Date.now() - this.lastActiveTimestamp < 60000);
  }

  public updatePeerPresence(identityId: string, isOnline: boolean, timestamp?: number): void {
    this.peerPresenceMap.set(identityId, {
      identityId,
      isOnline,
      lastSeenTimestamp: timestamp || Date.now(),
    });
    this.notify();
  }

  public getPeerPresence(identityId: string): PeerPresenceState | undefined {
    return this.peerPresenceMap.get(identityId);
  }

  /**
   * Formats presence subtitle for conversation header based on peer status & privacy rules.
   */
  public formatPresenceSubtitle(
    isContact: boolean,
    peerPresence?: PeerPresenceState,
    privacySetting: PresenceVisibility = 'nobody'
  ): string {
    if (privacySetting === 'nobody') {
      return 'Encrypted • Verified';
    }

    if (privacySetting === 'contacts' && !isContact) {
      return 'Encrypted • Verified';
    }

    if (!peerPresence) {
      return 'last seen recently';
    }

    if (peerPresence.isOnline) {
      return 'online';
    }

    if (!peerPresence.lastSeenTimestamp) {
      return 'last seen recently';
    }

    const elapsedMs = Date.now() - peerPresence.lastSeenTimestamp;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    if (elapsedMinutes < 1) {
      return 'last seen just now';
    }
    if (elapsedMinutes < 60) {
      return `last seen ${elapsedMinutes}m ago`;
    }
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return `last seen ${elapsedHours}h ago`;
    }

    return 'last seen recently';
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (_e) {}
    }
  }

  public destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.peerPresenceMap.clear();
    this.listeners.clear();
  }
}

export const presenceManager = new PresenceManager();
