/**
 * Lock Manager for VEIL Phase 7.
 *
 * Implements Quick Lock, Panic Lock, configurable Auto-Lock inactivity timers,
 * and integration with UI state clearing.
 */

import { SpaceVaultManager } from '../spaces/vault.ts';
import { UIStateManager } from './uiStateManager.ts';
import { LockState, AutoLockInterval, AUTO_LOCK_DURATIONS } from './types.ts';

export class LockManager {
  private vault: SpaceVaultManager;
  private uiState: UIStateManager;
  private spaceLockStates = new Map<string, LockState>();
  private autoLockTimers = new Map<string, NodeJS.Timeout | number>();
  private lastActivityTimestamps = new Map<string, number>();

  constructor(vault: SpaceVaultManager, uiState: UIStateManager) {
    this.vault = vault;
    this.uiState = uiState;
  }

  /**
   * Normal Quick Lock: Locks active Space, destroys volatile session,
   * clears its sensitive UI state, and marks as LOCKED.
   */
  public quickLock(spaceId: string): void {
    this.cancelAutoLockTimer(spaceId);
    this.vault.lockSpace(spaceId);
    this.uiState.clearSensitiveContent(spaceId);
    this.spaceLockStates.set(spaceId, 'LOCKED');
    this.lastActivityTimestamps.delete(spaceId);
  }

  /**
   * Aggressive Panic Lock: Immediately locks ALL Spaces, wipes all volatile session keys,
   * clears all sensitive UI state across all Spaces, and returns to neutral unlock screen.
   * Does NOT delete Spaces or revoke devices.
   */
  public panicLock(): void {
    // 1. Cancel all auto-lock timers
    for (const spaceId of this.autoLockTimers.keys()) {
      this.cancelAutoLockTimer(spaceId);
    }

    // 2. Lock all Spaces and wipe session keys in memory
    this.vault.lockAll();

    // 3. Wipe all tracked sensitive UI entries and search caches
    this.uiState.clearAllSensitiveContent();

    // 4. Mark all known Spaces as PANIC_LOCKED
    for (const envelope of this.vault.listEnvelopes()) {
      this.spaceLockStates.set(envelope.spaceId, 'PANIC_LOCKED');
    }

    this.lastActivityTimestamps.clear();
  }

  /**
   * Unlocks a Space via the vault and initializes lock state.
   */
  public unlockSpace(password: string, spaceId?: string) {
    const session = this.vault.unlockSpace(password, spaceId);
    this.spaceLockStates.set(session.spaceId, 'UNLOCKED');
    this.recordActivity(session.spaceId);
    return session;
  }

  /**
   * Starts or resets an auto-lock inactivity timer for a Space.
   */
  public startAutoLockTimer(
    spaceId: string,
    interval: AutoLockInterval,
    onLockCallback?: () => void
  ): void {
    this.cancelAutoLockTimer(spaceId);

    const durationMs = AUTO_LOCK_DURATIONS[interval];
    if (durationMs <= 0) {
      // 'off' or 'on_background'
      return;
    }

    this.lastActivityTimestamps.set(spaceId, Date.now());

    const timer = setTimeout(() => {
      this.quickLock(spaceId);
      if (onLockCallback) {
        onLockCallback();
      }
    }, durationMs);

    this.autoLockTimers.set(spaceId, timer);
  }

  /**
   * Records user activity, resetting the auto-lock timer if active.
   */
  public recordActivity(spaceId: string, interval?: AutoLockInterval, onLockCallback?: () => void): void {
    this.lastActivityTimestamps.set(spaceId, Date.now());
    if (interval && interval !== 'off' && interval !== 'on_background') {
      this.startAutoLockTimer(spaceId, interval, onLockCallback);
    }
  }

  /**
   * Cancels any pending auto-lock timer for a Space.
   */
  public cancelAutoLockTimer(spaceId: string): void {
    const existing = this.autoLockTimers.get(spaceId);
    if (existing) {
      clearTimeout(existing as any);
      this.autoLockTimers.delete(spaceId);
    }
  }

  /**
   * Handles app background event (for 'on_background' auto-lock setting).
   */
  public onAppBackground(spaceId: string, interval: AutoLockInterval): void {
    if (interval === 'on_background') {
      this.quickLock(spaceId);
    }
  }

  /**
   * Gets the lock state of a Space.
   */
  public getLockState(spaceId: string): LockState {
    const session = this.vault.getActiveSession(spaceId);
    if (session && session.isActive()) {
      return 'UNLOCKED';
    }
    return this.spaceLockStates.get(spaceId) ?? 'LOCKED';
  }

  /**
   * Resets all states.
   */
  public reset(): void {
    this.panicLock();
    this.spaceLockStates.clear();
  }
}
