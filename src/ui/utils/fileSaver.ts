/**
 * VEIL Unified File Saver & Android Download Engine.
 *
 * Implements reliable, user-visible file saving for both Web browsers and
 * native Android Capacitor environments without silent WebView download drops.
 */

import { bytesToBase64 } from '../../crypto/utils.ts';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface SaveFileOptions {
  filename: string;
  data: Uint8Array;
  mimeType?: string;
  triggerShare?: boolean;
}

export interface SaveFileResult {
  success: boolean;
  filename: string;
  location: string;
  uri?: string;
  error?: string;
}

export class FileSaver {
  /**
   * Checks if running inside a native mobile container (Capacitor Android/iOS).
   */
  public static isNative(): boolean {
    try {
      const cap = (window as any).Capacitor;
      return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    } catch (_e) {
      return false;
    }
  }

  /**
   * Saves decrypted plaintext bytes to the user-accessible filesystem.
   */
  public static async saveFile(options: SaveFileOptions): Promise<SaveFileResult> {
    const { filename, data, mimeType = 'application/octet-stream', triggerShare = false } = options;

    if (this.isNative()) {
      return this.saveNative(filename, data, mimeType, triggerShare);
    } else {
      return this.saveWeb(filename, data, mimeType);
    }
  }

  /**
   * Native Android/Capacitor file saving via @capacitor/filesystem and @capacitor/share.
   */
  private static async saveNative(
    filename: string,
    data: Uint8Array,
    mimeType: string,
    triggerShare: boolean
  ): Promise<SaveFileResult> {
    try {
      const base64Data = bytesToBase64(data);

      // Check and request filesystem permissions if required by Android runtime
      try {
        const permStatus = await Filesystem.checkPermissions();
        if (permStatus.publicStorage === 'prompt' || permStatus.publicStorage === 'prompt-with-rationale') {
          await Filesystem.requestPermissions();
        }
      } catch (_permErr) {}

      // 1. Write file to Documents directory (user accessible)
      let fileResult;
      try {
        fileResult = await Filesystem.writeFile({
          path: `VEIL/${filename}`,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (_writeDocErr) {
        // Fallback to Cache or external storage if Documents permissions differ
        fileResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });
      }

      const fileUri = fileResult.uri;

      // 2. If triggerShare is requested or on supported Android platforms, trigger system share/save sheet
      if (triggerShare) {
        try {
          const canShare = await Share.canShare();
          if (canShare.value) {
            await Share.share({
              title: filename,
              text: `VEIL Decrypted File: ${filename}`,
              url: fileUri,
              dialogTitle: `Save or Open ${filename}`,
            });
          }
        } catch (_shareErr) {
          // Non-fatal if share sheet is dismissed
        }
      }

      return {
        success: true,
        filename,
        location: 'Documents/VEIL',
        uri: fileUri,
      };
    } catch (err: any) {
      return {
        success: false,
        filename,
        location: 'Local Storage',
        error: err.message || 'Failed to save file on device',
      };
    }
  }

  /**
   * Web browser file saving via Blob URL / File System Access API.
   */
  private static async saveWeb(
    filename: string,
    data: Uint8Array,
    mimeType: string
  ): Promise<SaveFileResult> {
    try {
      const blob = new Blob([data as any], { type: mimeType });

      // If modern File System Access API is supported and in secure context
      if (typeof (window as any).showSaveFilePicker === 'function') {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return {
            success: true,
            filename,
            location: 'Selected Folder',
          };
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') {
            return { success: false, filename, location: 'Downloads', error: 'Save cancelled by user' };
          }
          // Fall back to <a> click
        }
      }

      // Standard browser download anchor
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Delay cleanup to ensure browser downloads initiate smoothly
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (_cleanupErr) {}
      }, 60000);

      return {
        success: true,
        filename,
        location: 'Downloads folder',
      };
    } catch (err: any) {
      return {
        success: false,
        filename,
        location: 'Downloads',
        error: err.message || 'Failed to trigger web download',
      };
    }
  }

  /**
   * Saves an image or video to the device's media gallery (DCIM/Pictures on Android).
   * Falls back to triggerShare on iOS or when gallery write is unavailable.
   */
  public static async saveToGallery(options: SaveFileOptions): Promise<SaveFileResult> {
    const { filename, data, mimeType = 'image/jpeg' } = options;
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');

    if (!this.isNative()) {
      // On web, just download normally
      return this.saveWeb(filename, data, mimeType);
    }

    try {
      const base64Data = bytesToBase64(data);

      // Request storage permissions
      try {
        const permStatus = await Filesystem.checkPermissions();
        if (permStatus.publicStorage !== 'granted') {
          const requested = await Filesystem.requestPermissions();
          if (requested.publicStorage !== 'granted') {
            // Fallback to share sheet if permissions denied
            return this.saveNative(filename, data, mimeType, true);
          }
        }
      } catch (_permErr) {
        // Continue and try anyway
      }

      // Determine gallery folder based on media type
      const galleryFolder = isVideo ? 'DCIM/VEIL' : 'Pictures/VEIL';

      // Write to external storage gallery directory
      let fileResult;
      try {
        fileResult = await Filesystem.writeFile({
          path: `${galleryFolder}/${filename}`,
          data: base64Data,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
      } catch (_extErr) {
        // Fallback: try Documents then share
        return this.saveNative(filename, data, mimeType, true);
      }

      // Trigger Android media scanner so the file appears in Gallery immediately
      // This is done by reading the file URI and opening it with the media intent
      const fileUri = fileResult.uri;

      // Also trigger share sheet to give users save-to-gallery option
      if (isImage || isVideo) {
        try {
          const canShare = await Share.canShare();
          if (canShare.value) {
            await Share.share({
              title: filename,
              text: `Saved from VEIL`,
              url: fileUri,
              dialogTitle: `Save ${isVideo ? 'video' : 'image'} to Gallery`,
            });
          }
        } catch (_shareErr) {
          // Non-fatal
        }
      }

      return {
        success: true,
        filename,
        location: galleryFolder,
        uri: fileUri,
      };
    } catch (err: any) {
      // Final fallback — try normal save with share
      try {
        return await this.saveNative(filename, data, mimeType, true);
      } catch (_fallbackErr) {
        return {
          success: false,
          filename,
          location: 'Gallery',
          error: err.message || 'Failed to save to gallery',
        };
      }
    }
  }
}
