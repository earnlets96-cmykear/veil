import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpacePinManager } from '../src/privacy/pinManager.ts';

const registryKey = 'veil:device_pin_registry';
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
  removeItem: (key: string) => { values.delete(key); },
  clear: () => values.clear(),
};

function legacyRegistry(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    deviceSalt: 'c2FsdA==',
    appLockEnabled: true,
    autoLockInterval: '5m',
    lockOnBackground: true,
    lockOnScreenOff: true,
    biometricsEnabled: false,
    failedAttempts: 0,
    lockedUntilEpoch: 0,
    entries: {},
    ...overrides,
  };
}

describe('App Lock persisted delay settings', () => {
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  });
  afterEach(() => vi.restoreAllMocks());

  it('migrates legacy background and exit delays to the shorter delay', () => {
    localStorage.setItem(registryKey, JSON.stringify(legacyRegistry({ afterBackground: '1m', afterExitingApp: '5m' })));
    const manager = new SpacePinManager();
    expect(manager.getLeaveAppLockDelay()).toBe('1m');
  });

  it('preserves legacy never behavior when background locking was disabled', () => {
    localStorage.setItem(registryKey, JSON.stringify(legacyRegistry({ afterBackground: '5m', lockOnBackground: false })));
    const manager = new SpacePinManager();
    expect(manager.getLeaveAppLockDelay()).toBe('never');
  });

  it('uses safe defaults for corrupt legacy delay values', () => {
    localStorage.setItem(registryKey, JSON.stringify(legacyRegistry({
      afterBackground: 'whenever',
      afterInactivity: 'hours',
      afterScreenOff: 'sometimes',
    })));
    const manager = new SpacePinManager();
    expect(manager.getLeaveAppLockDelay()).toBe('5m');
    expect(manager.getInactivityLockDelay()).toBe('10m');
    expect(manager.getScreenOffLockDelay()).toBe('immediately');
  });

  it('persists each canonical delay and reads it after manager recreation', () => {
    const manager = new SpacePinManager();
    expect(manager.setLeaveAppLockDelay('10m')).toBe(true);
    expect(manager.setInactivityLockDelay('15m')).toBe(true);
    expect(manager.setScreenOffLockDelay('30s')).toBe(true);

    const reloaded = new SpacePinManager();
    expect(reloaded.getLeaveAppLockDelay()).toBe('10m');
    expect(reloaded.getInactivityLockDelay()).toBe('15m');
    expect(reloaded.getScreenOffLockDelay()).toBe('30s');
  });

  it('keeps the previous selection in memory when persistence fails', () => {
    const manager = new SpacePinManager();
    const saved = manager.getLeaveAppLockDelay();
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });

    expect(manager.setLeaveAppLockDelay('immediately')).toBe(false);
    expect(manager.getLeaveAppLockDelay()).toBe(saved);
  });
});
