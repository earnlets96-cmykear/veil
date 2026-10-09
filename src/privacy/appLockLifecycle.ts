import { AppLockDelay } from './appLockPolicy.ts';
import { shouldLockForElapsed } from './appLockPolicy.ts';

export interface AppLockResumeInput {
  appLockEnabled: boolean;
  pickerActive: boolean;
  leaveAppDelay: AppLockDelay;
  backgroundElapsedMs: number | null;
  screenOffDelay: AppLockDelay;
  screenOffElapsedMs: number | null;
}

export function shouldLockOnResume(input: AppLockResumeInput): boolean {
  if (!input.appLockEnabled || input.pickerActive) return false;
  return (input.backgroundElapsedMs !== null && shouldLockForElapsed(input.leaveAppDelay, input.backgroundElapsedMs)) ||
    (input.screenOffElapsedMs !== null && shouldLockForElapsed(input.screenOffDelay, input.screenOffElapsedMs));
}

interface InactivityTimerOptions {
  documentTarget?: EventTarget;
  windowTarget?: EventTarget;
  onLock: () => void;
  shouldDeferLock?: () => boolean;
}

const delayMs: Record<AppLockDelay, number> = {
  immediately: 0,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
  '10m': 600_000,
  '15m': 900_000,
  never: Infinity,
};

export function startInactivityLockTimer(delay: AppLockDelay, options: InactivityTimerOptions): () => void {
  if (delay === 'never') return () => {};
  const documentTarget = options.documentTarget ?? (typeof document !== 'undefined' ? document : undefined);
  const windowTarget = options.windowTarget ?? (typeof window !== 'undefined' ? window : undefined);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const schedule = (ms = delayMs[delay]) => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      if (disposed) return;
      if (options.shouldDeferLock?.()) {
        schedule(Math.min(1000, delayMs[delay]));
        return;
      }
      options.onLock();
    }, ms);
  };
  const reset = () => schedule();

  schedule();
  documentTarget?.addEventListener('pointermove', reset, { passive: true });
  documentTarget?.addEventListener('pointerdown', reset, { passive: true });
  documentTarget?.addEventListener('keydown', reset);
  documentTarget?.addEventListener('touchstart', reset, { passive: true });
  windowTarget?.addEventListener('veil:app-lock-user-activity', reset);

  return () => {
    disposed = true;
    clearTimer();
    documentTarget?.removeEventListener('pointermove', reset);
    documentTarget?.removeEventListener('pointerdown', reset);
    documentTarget?.removeEventListener('keydown', reset);
    documentTarget?.removeEventListener('touchstart', reset);
    windowTarget?.removeEventListener('veil:app-lock-user-activity', reset);
  };
}
