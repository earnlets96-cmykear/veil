import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { UIStateManager } from '../src/privacy/uiStateManager.ts';
import { LockManager } from '../src/privacy/lockManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 7: Auto-Lock Inactivity & Background Tests', () => {
  let vault: SpaceVaultManager;
  let uiState: UIStateManager;
  let lockMgr: LockManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vault = new SpaceVaultManager();
    uiState = new UIStateManager();
    lockMgr = new LockManager(vault, uiState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AUTO-LOCK: Automatically locks Space after configured inactivity duration', () => {
    const header = vault.createSpace({ name: 'Work', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = lockMgr.unlockSpace('Pass', header.spaceId);
    expect(sess.isActive()).toBe(true);

    let lockedCallbackTriggered = false;
    lockMgr.startAutoLockTimer(header.spaceId, '1min', () => {
      lockedCallbackTriggered = true;
    });

    // Advance time by 30 seconds -> Space should still be unlocked
    vi.advanceTimersByTime(30_000);
    expect(lockMgr.getLockState(header.spaceId)).toBe('UNLOCKED');
    expect(lockedCallbackTriggered).toBe(false);

    // Advance remaining 30 seconds -> Space should automatically lock
    vi.advanceTimersByTime(30_000);
    expect(lockMgr.getLockState(header.spaceId)).toBe('LOCKED');
    expect(lockedCallbackTriggered).toBe(true);
    expect(sess.isActive()).toBe(false);
  });

  it('ACTIVITY RESET: User activity resets the auto-lock countdown', () => {
    const header = vault.createSpace({ name: 'Work', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = lockMgr.unlockSpace('Pass', header.spaceId);

    lockMgr.startAutoLockTimer(header.spaceId, '1min');

    // 45 seconds pass
    vi.advanceTimersByTime(45_000);
    expect(lockMgr.getLockState(header.spaceId)).toBe('UNLOCKED');

    // User types/sends message -> recordActivity resets timer
    lockMgr.recordActivity(header.spaceId, '1min');

    // Another 45 seconds pass (90s total, but only 45s since activity)
    vi.advanceTimersByTime(45_000);
    expect(lockMgr.getLockState(header.spaceId)).toBe('UNLOCKED');

    // Another 20 seconds pass -> now 65s since activity -> locks
    vi.advanceTimersByTime(20_000);
    expect(lockMgr.getLockState(header.spaceId)).toBe('LOCKED');
  });

  it('ON BACKGROUND: Automatically locks when onAppBackground is triggered with on_background setting', () => {
    const header = vault.createSpace({ name: 'Work', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = lockMgr.unlockSpace('Pass', header.spaceId);

    // Trigger app background event
    lockMgr.onAppBackground(header.spaceId, 'on_background');

    expect(lockMgr.getLockState(header.spaceId)).toBe('LOCKED');
    expect(sess.isActive()).toBe(false);
  });
});
