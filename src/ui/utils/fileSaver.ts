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
      const blob = new Blob([data], { type: mimeType });

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
}
