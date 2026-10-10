import { Capacitor, registerPlugin } from '@capacitor/core';
import { base64ToBytes } from '../crypto/utils.ts';

export type DeviceMediaPermissionStatus = 'granted' | 'limited' | 'denied' | 'prompt' | 'unavailable';
export type DeviceMediaType = 'image' | 'video' | 'file';

export interface DeviceMediaItem {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailDataUrl?: string;
}

export interface DeviceMediaPage {
  items: DeviceMediaItem[];
  nextCursor?: string;
}

export interface NativeDeviceMediaPluginInterface {
  requestRecentMediaPermission(): Promise<{ status: DeviceMediaPermissionStatus }>;
  listRecentMedia(options: { cursor?: string; limit: number; types: DeviceMediaType[] }): Promise<DeviceMediaPage>;
  readMediaChunk(options: { uri: string; offset: number; length: number }): Promise<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    base64Data: string;
    bytesRead?: number;
    isLast?: boolean;
  }>;
  getThumbnail(options: { uri: string }): Promise<{ thumbnailDataUrl?: string }>;
  pickDocuments(): Promise<{ items: DeviceMediaItem[] }>;
  captureMedia(): Promise<{ items: DeviceMediaItem[] }>;
  saveToGallery(options: { filename: string; mimeType: string; base64Data: string }): Promise<{ uri: string; location: string }>;
}

const NativeDeviceMedia = registerPlugin<NativeDeviceMediaPluginInterface>('VeilDeviceMedia');

type DeviceMediaTestAdapter = Partial<NativeDeviceMediaPluginInterface> & {
  isNative: () => boolean;
};

export class NativeDeviceMediaBridge {
  private permissionRequests = 0;

  public constructor(private readonly adapter?: DeviceMediaTestAdapter) {}

  public static getInstance(): NativeDeviceMediaBridge {
    return deviceMediaBridge;
  }

  public static createForTesting(adapter: DeviceMediaTestAdapter): NativeDeviceMediaBridge {
    return new NativeDeviceMediaBridge(adapter);
  }

  public isNative(): boolean {
    return this.adapter ? this.adapter.isNative() : Capacitor.isNativePlatform();
  }

  public permissionRequestCount(): number {
    return this.permissionRequests;
  }

  public async requestRecentMediaPermission(): Promise<{ status: DeviceMediaPermissionStatus }> {
    if (!this.isNative()) return { status: 'unavailable' };
    this.permissionRequests += 1;
    const request = this.adapter?.requestRecentMediaPermission || NativeDeviceMedia.requestRecentMediaPermission;
    return request();
  }

  public async listRecentMedia(options: { cursor?: string; limit: number; types: DeviceMediaType[] }): Promise<DeviceMediaPage> {
    if (!this.isNative()) return { items: [] };
    const list = this.adapter?.listRecentMedia || NativeDeviceMedia.listRecentMedia;
    const page = await list({ ...options, limit: Math.max(1, Math.min(60, options.limit)) });
    return {
      items: (page.items || []).map((item) => ({
        uri: String(item.uri),
        name: String(item.name || 'media'),
        mimeType: String(item.mimeType || 'application/octet-stream'),
        sizeBytes: Math.max(0, Number(item.sizeBytes) || 0),
        thumbnailDataUrl: item.thumbnailDataUrl,
      })),
      ...(page.nextCursor ? { nextCursor: String(page.nextCursor) } : {}),
    };
  }

  public async readMediaChunk(uri: string, offset: number, length: number): Promise<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    base64Data: string;
    bytesRead?: number;
    isLast?: boolean;
  }> {
    if (!this.isNative()) throw new Error('Device media is unavailable on the web');
    const read = this.adapter?.readMediaChunk || NativeDeviceMedia.readMediaChunk;
    return read({ uri, offset, length });
  }

  public async getThumbnail(uri: string): Promise<string | undefined> {
    if (!this.isNative()) return undefined;
    const load = this.adapter?.getThumbnail || NativeDeviceMedia.getThumbnail;
    const result = await load({ uri });
    return typeof result.thumbnailDataUrl === 'string' ? result.thumbnailDataUrl : undefined;
  }

  /** Creates a zero-byte selection token; file bytes are read only when Send is pressed. */
  public createSelectionPlaceholder(item: DeviceMediaItem): File {
    return new File([], item.name, { type: item.mimeType });
  }

  /**
   * Reads an item only after the person has tapped it to stage an attachment.
   * The bytes remain in memory so the existing encrypted attachment pipeline is
   * still the only path that prepares a relay upload.
   */
  private static onPickerActiveCallback?: () => void;
  private static onPickerInactiveCallback?: () => void;

  public static setPickerListeners(onActive: () => void, onInactive: () => void): () => void {
    NativeDeviceMediaBridge.onPickerActiveCallback = onActive;
    NativeDeviceMediaBridge.onPickerInactiveCallback = onInactive;
    return () => {
      NativeDeviceMediaBridge.onPickerActiveCallback = undefined;
      NativeDeviceMediaBridge.onPickerInactiveCallback = undefined;
    };
  }

  public static notifyPickerActive(active: boolean): void {
    if (active) {
      NativeDeviceMediaBridge.onPickerActiveCallback?.();
    } else {
      NativeDeviceMediaBridge.onPickerInactiveCallback?.();
    }
  }

  public async fileFromUri(uri: string, onProgress?: (loadedBytes: number, totalBytes: number) => void): Promise<File> {
    const chunkSize = 1024 * 1024;
    const parts: Uint8Array[] = [];
    let metadata: { name: string; mimeType: string; sizeBytes: number } | undefined;
    onProgress?.(0, 0);
    for (let offset = 0; ; offset += chunkSize) {
      const response = await this.readMediaChunk(uri, offset, chunkSize);
      metadata ||= {
        name: response.name,
        mimeType: response.mimeType,
        sizeBytes: response.sizeBytes,
      };
      if (response.base64Data.length > Math.ceil(chunkSize * 4 / 3) + 8) {
        throw new Error('Selected media returned an invalid chunk');
      }
      const bytes = base64ToBytes(response.base64Data);
      if (response.bytesRead !== undefined && response.bytesRead !== bytes.length) {
        throw new Error('Selected media returned an invalid chunk');
      }
      if (bytes.length > chunkSize) throw new Error('Selected media returned an invalid chunk');
      if (bytes.length > 0) parts.push(bytes);
      onProgress?.(offset + bytes.length, metadata.sizeBytes);

      const isLast = response.isLast ?? offset + bytes.length >= metadata.sizeBytes;
      if (isLast) break;
      if (bytes.length === 0) throw new Error('Selected media ended before all chunks were read');
      if (offset > Number.MAX_SAFE_INTEGER - chunkSize) throw new Error('Selected media is too large to read');
    }
    if (!metadata) throw new Error('Selected media could not be read');
    return new File(parts as unknown as BlobPart[], metadata.name, { type: metadata.mimeType });
  }

  public async pickDocuments(): Promise<DeviceMediaItem[]> {
    if (!this.isNative()) return [];
    NativeDeviceMediaBridge.notifyPickerActive(true);
    try {
      const pick = this.adapter?.pickDocuments || NativeDeviceMedia.pickDocuments;
      return (await pick()).items || [];
    } finally {
      NativeDeviceMediaBridge.notifyPickerActive(false);
    }
  }

  public async captureMedia(): Promise<DeviceMediaItem[]> {
    if (!this.isNative()) return [];
    NativeDeviceMediaBridge.notifyPickerActive(true);
    try {
      const capture = this.adapter?.captureMedia || NativeDeviceMedia.captureMedia;
      return (await capture()).items || [];
    } finally {
      NativeDeviceMediaBridge.notifyPickerActive(false);
    }
  }

  public async saveToGallery(options: { filename: string; mimeType: string; base64Data: string }): Promise<{ uri: string; location: string }> {
    if (!this.isNative()) throw new Error('Gallery saving is unavailable on the web');
    const save = this.adapter?.saveToGallery || NativeDeviceMedia.saveToGallery;
    return save(options);
  }
}

const deviceMediaBridge = new NativeDeviceMediaBridge();
