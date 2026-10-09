import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAppLockPlugin {
  consumePendingScreenOffElapsedMs(): Promise<{ elapsedMs: number | null }>;
}

const nativeAppLock = registerPlugin<NativeAppLockPlugin>('VeilAppLock');

export function isAppLockScreenOffSupported(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('VeilAppLock');
}

export async function consumePendingScreenOffElapsedMs(): Promise<number | null> {
  if (!isAppLockScreenOffSupported()) return null;
  try {
    const result = await nativeAppLock.consumePendingScreenOffElapsedMs();
    return typeof result.elapsedMs === 'number' && Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0
      ? result.elapsedMs
      : null;
  } catch {
    return null;
  }
}
