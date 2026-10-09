import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface VeilShareIntentPlugin {
  addListener(eventName: 'sharedText', listener: (event: { text?: string | null }) => void): Promise<PluginListenerHandle>;
  getPendingSharedText(): Promise<{ text?: string | null }>;
  clearPendingSharedText(): Promise<void>;
}

const nativeShareIntent = registerPlugin<VeilShareIntentPlugin>('VeilShareIntent');

export async function addNativeSharedTextListener(
  listener: (text: string) => void
): Promise<PluginListenerHandle | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  return nativeShareIntent.addListener('sharedText', (event) => {
    if (typeof event.text === 'string') listener(event.text);
  });
}

export async function getPendingNativeSharedText(): Promise<string | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  const result = await nativeShareIntent.getPendingSharedText();
  return typeof result.text === 'string' ? result.text : null;
}

export async function clearPendingNativeSharedText(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await nativeShareIntent.clearPendingSharedText();
}
