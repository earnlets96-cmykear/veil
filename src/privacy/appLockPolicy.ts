export type AppLockDelay = 'immediately' | '30s' | '1m' | '5m' | '10m' | '15m' | 'never';

const DELAY_MS: Record<AppLockDelay, number> = {
  immediately: 0,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
  '10m': 600_000,
  '15m': 900_000,
  never: Infinity,
};

export function isAppLockDelay(value: unknown): value is AppLockDelay {
  return typeof value === 'string' && Object.hasOwn(DELAY_MS, value);
}

export function normalizeAppLockDelay(value: unknown, safeDefault: AppLockDelay): AppLockDelay {
  return isAppLockDelay(value) ? value : safeDefault;
}

export function lockDelayMs(delay: AppLockDelay): number {
  return DELAY_MS[delay];
}

export function shouldLockForElapsed(delay: AppLockDelay, elapsedMs: number): boolean {
  const threshold = lockDelayMs(delay);
  if (threshold === Infinity) return false;
  if (threshold === 0) return true;
  return Number.isFinite(elapsedMs) && elapsedMs >= threshold;
}
