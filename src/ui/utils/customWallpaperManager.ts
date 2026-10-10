import { customWallpaperStore } from './customWallpaperStore.ts';
import { themeManager } from './themeManager.ts';

const CSS_PROPERTY = '--veil-custom-wallpaper-image';

export class CustomWallpaperManager {
  private activeUrl: string | null = null;

  private async assertValidStoredImage(blob: Blob): Promise<void> {
    if (blob.type !== 'image/webp' || typeof createImageBitmap === 'undefined') throw new Error('Saved wallpaper is unavailable.');
    const decoded = await createImageBitmap(blob);
    try {
      if (!decoded.width || !decoded.height || decoded.width * decoded.height > 40_000_000 || Math.max(decoded.width, decoded.height) > 2400) {
        throw new Error('Saved wallpaper is invalid.');
      }
    } finally {
      decoded.close();
    }
  }

  async replace(blob: Blob): Promise<void> {
    await customWallpaperStore.save(blob);
    this.applyBlob(blob);
    themeManager.setWallpaper('custom');
  }

  private applyBlob(blob: Blob): void {
    const nextUrl = URL.createObjectURL(blob);
    const root = document.documentElement;
    root.style.setProperty(CSS_PROPERTY, `url("${nextUrl}")`);
    if (this.activeUrl) URL.revokeObjectURL(this.activeUrl);
    this.activeUrl = nextUrl;
  }

  async restoreIfSelected(): Promise<void> {
    if (themeManager.getPreferences().wallpaper !== 'custom') return;
    try {
      const blob = await customWallpaperStore.load();
      if (!blob) throw new Error('Saved wallpaper is unavailable.');
      await this.assertValidStoredImage(blob);
      this.applyBlob(blob);
    } catch {
      themeManager.restoreLastBuiltInWallpaper();
    }
  }

  async selectSaved(): Promise<void> {
    const blob = await customWallpaperStore.load();
    if (!blob) throw new Error('No saved photo wallpaper is available.');
    await this.assertValidStoredImage(blob);
    this.applyBlob(blob);
    themeManager.setWallpaper('custom');
  }

  async remove(): Promise<void> {
    const wasSelected = themeManager.getPreferences().wallpaper === 'custom';
    await customWallpaperStore.remove();
    this.clearUrl();
    if (wasSelected) themeManager.restoreLastBuiltInWallpaper();
  }

  dispose(): void {
    this.clearUrl();
  }

  private clearUrl(): void {
    document.documentElement.style.removeProperty(CSS_PROPERTY);
    if (this.activeUrl) URL.revokeObjectURL(this.activeUrl);
    this.activeUrl = null;
  }
}

export const customWallpaperManager = new CustomWallpaperManager();
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => customWallpaperManager.dispose(), { once: true });

export function restoreCustomWallpaperAtStartup(): void {
  void customWallpaperManager.restoreIfSelected();
}
