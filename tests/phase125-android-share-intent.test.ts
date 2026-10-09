import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

describe('Phase 126 Android social-video share intake', () => {
  it('registers VEIL as an Android text-share target', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');

    expect(manifest).toContain('<action android:name="android.intent.action.SEND" />');
    expect(manifest).toContain('<category android:name="android.intent.category.DEFAULT" />');
    expect(manifest).toContain('<data android:mimeType="text/plain" />');
  });

  it('registers the native share bridge and forwards warm-start intents', () => {
    const activity = read('android/app/src/main/java/chat/veil/app/MainActivity.java');
    const plugin = read('android/app/src/main/java/chat/veil/app/VeilShareIntentPlugin.kt');

    expect(activity).toContain('registerPlugin(VeilShareIntentPlugin.class)');
    expect(plugin).toContain('Intent.ACTION_SEND');
    expect(plugin).toContain('Intent.EXTRA_TEXT');
    expect(plugin).toContain('handleOnNewIntent');
    expect(plugin).toContain('getPendingSharedText');
    expect(plugin).toContain('clearPendingSharedText');
  });

  it('bounds and retains the incoming share only in process memory without logging it', () => {
    const plugin = read('android/app/src/main/java/chat/veil/app/VeilShareIntentPlugin.kt');

    expect(plugin).toContain('MAX_SHARED_TEXT_LENGTH');
    expect(plugin).toContain('notifyListeners("sharedText"');
    expect(plugin).not.toMatch(/Log\.[a-zA-Z]+\([^\n]*(sharedText|pendingSharedText)/);
    expect(plugin).not.toMatch(/SharedPreferences|FileOutputStream|openFileOutput/);
  });

  it('hides the pending share chooser while the app is locked', () => {
    const app = read('src/ui/App.tsx');
    expect(app).toContain('if (!activeSession?.isActive() || isAppLocked) setPendingSharedVideo(null)');
    expect(app).toContain('{pendingSharedVideo && activeSession?.isActive() && !isAppLocked');
  });
});
