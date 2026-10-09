import { describe, expect, it } from 'vitest';
import { lockDelayMs, shouldLockForElapsed, normalizeAppLockDelay } from '../src/privacy/appLockPolicy.ts';

describe('App Lock delay policy', () => {
  it('maps every supported delay to a finite duration or infinity', () => {
    expect(lockDelayMs('immediately')).toBe(0);
    expect(lockDelayMs('30s')).toBe(30_000);
    expect(lockDelayMs('1m')).toBe(60_000);
    expect(lockDelayMs('5m')).toBe(300_000);
    expect(lockDelayMs('10m')).toBe(600_000);
    expect(lockDelayMs('15m')).toBe(900_000);
    expect(lockDelayMs('never')).toBe(Infinity);
  });

  it('applies finite delays at the exact elapsed boundary', () => {
    expect(shouldLockForElapsed('5m', 299_999)).toBe(false);
    expect(shouldLockForElapsed('5m', 300_000)).toBe(true);
  });

  it('never locks from an elapsed transition when set to never', () => {
    expect(shouldLockForElapsed('never', Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('normalizes corrupt persisted values to the supplied safe default', () => {
    expect(normalizeAppLockDelay('30s', '5m')).toBe('30s');
    expect(normalizeAppLockDelay('hour', '5m')).toBe('5m');
    expect(normalizeAppLockDelay(null, 'immediately')).toBe('immediately');
  });

  it('treats immediate as a lock at the first background event', () => {
    expect(shouldLockForElapsed('immediately', 0)).toBe(true);
  });
});
