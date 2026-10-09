import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { shouldLockOnResume, startInactivityLockTimer } from '../src/privacy/appLockLifecycle.ts';

describe('App Lock lifecycle policy', () => {
  afterEach(() => vi.useRealTimers());

  it('checks leave-app and screen-off delays independently on resume', () => {
    expect(shouldLockOnResume({
      appLockEnabled: true,
      pickerActive: false,
      leaveAppDelay: '5m',
      backgroundElapsedMs: 299_999,
      screenOffDelay: '1m',
      screenOffElapsedMs: 60_000,
    })).toBe(true);
    expect(shouldLockOnResume({
      appLockEnabled: true,
      pickerActive: false,
      leaveAppDelay: 'never',
      backgroundElapsedMs: 999_999,
      screenOffDelay: 'never',
      screenOffElapsedMs: 999_999,
    })).toBe(false);
  });

  it('keeps the existing media-picker exception', () => {
    expect(shouldLockOnResume({
      appLockEnabled: true,
      pickerActive: true,
      leaveAppDelay: 'immediately',
      backgroundElapsedMs: 600_000,
      screenOffDelay: 'immediately',
      screenOffElapsedMs: 600_000,
    })).toBe(false);
  });

  it('resets foreground inactivity on pointer, key, touch, and picker return activity', () => {
    vi.useFakeTimers();
    const documentTarget = new EventTarget();
    const windowTarget = new EventTarget();
    const lock = vi.fn();
    const cleanup = startInactivityLockTimer('1m', { documentTarget, windowTarget, onLock: lock });

    vi.advanceTimersByTime(59_000);
    documentTarget.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(59_000);
    documentTarget.dispatchEvent(new Event('pointermove'));
    vi.advanceTimersByTime(59_000);
    documentTarget.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(59_000);
    windowTarget.dispatchEvent(new Event('veil:app-lock-user-activity'));
    vi.advanceTimersByTime(59_999);
    expect(lock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(lock).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('defers a timer while the file picker owns foreground control and cleans up listeners', () => {
    vi.useFakeTimers();
    const documentTarget = new EventTarget();
    const windowTarget = new EventTarget();
    const lock = vi.fn();
    let pickerActive = true;
    const cleanup = startInactivityLockTimer('30s', {
      documentTarget,
      windowTarget,
      onLock: lock,
      shouldDeferLock: () => pickerActive,
    });
    vi.advanceTimersByTime(31_000);
    expect(lock).not.toHaveBeenCalled();
    pickerActive = false;
    windowTarget.dispatchEvent(new Event('veil:app-lock-user-activity'));
    vi.advanceTimersByTime(29_999);
    expect(lock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(lock).toHaveBeenCalledTimes(1);
    cleanup();
    documentTarget.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(60_000);
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('does not create a foreground timer for never and does not lock if app lock is disabled', () => {
    vi.useFakeTimers();
    const documentTarget = new EventTarget();
    const lock = vi.fn();
    const cleanup = startInactivityLockTimer('never', { documentTarget, onLock: lock });
    vi.advanceTimersByTime(1_000_000);
    expect(lock).not.toHaveBeenCalled();
    cleanup();
    expect(shouldLockOnResume({
      appLockEnabled: false,
      pickerActive: false,
      leaveAppDelay: 'immediately',
      backgroundElapsedMs: 0,
      screenOffDelay: 'immediately',
      screenOffElapsedMs: 0,
    })).toBe(false);
  });

  it('registers and removes the Android screen-off receiver and persists only a monotonic marker', () => {
    const plugin = readFileSync('android/app/src/main/java/chat/veil/app/VeilAppLockPlugin.kt', 'utf8');
    const activity = readFileSync('android/app/src/main/java/chat/veil/app/MainActivity.java', 'utf8');
    expect(activity).toContain('registerPlugin(VeilAppLockPlugin.class)');
    expect(plugin).toContain('Intent.ACTION_SCREEN_OFF');
    expect(plugin).toContain('SystemClock.elapsedRealtime()');
    expect(plugin).toContain('.putLong(PENDING_SCREEN_OFF_AT');
    expect(plugin).toContain('context.unregisterReceiver(receiver)');
    expect(plugin).toContain('preferences.edit().remove(PENDING_SCREEN_OFF_AT).commit()');
    expect(plugin).not.toContain('.putString(');
  });
});
