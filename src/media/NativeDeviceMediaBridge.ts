import { Capacitor, registerPlugin } from '@capacitor/core';
import { MediaWorkerPool } from '../attachments/mediaWorkerPool.ts';

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

  private normalizePickedItems(items: DeviceMediaItem[] | undefined): DeviceMediaItem[] {
    return (items || []).map((item) => ({
      uri: String(item.uri),
      name: String(item.name || 'media'),
      mimeType: String(item.mimeType || 'application/octet-stream'),
      // Android document providers use -1 when OpenableColumns.SIZE is unknown.
      sizeBytes: Math.max(0, Number(item.sizeBytes) || 0),
      thumbnailDataUrl: item.thumbnailDataUrl,
    }));
  }

  /** Creates a zero-byte selection token; file bytes are read only when Send is pressed. */
  public createSelectionPlaceholder(item: DeviceMediaItem): File {
    const file = new File([], item.name, { type: item.mimeType });
    (file as any).deviceUri = item.uri;
    (file as any).thumbnailUrl = item.thumbnailDataUrl;
    (file as any).deviceMetadata = item;
    return file;
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
      const bytes = await MediaWorkerPool.getInstance().decodeBase64(response.base64Data);
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

  /** Reads a provider-backed selection once into the single buffer consumed by encryption. */
  public async bytesFromUri(
    uri: string,
    onProgress?: (loadedBytes: number, totalBytes: number) => void
  ): Promise<{ bytes: Uint8Array; name: string; mimeType: string }> {
    const chunkSize = 1024 * 1024;
    let output: Uint8Array | undefined;
    let metadata: { name: string; mimeType: string; sizeBytes: number } | undefined;
    let loaded = 0;
    onProgress?.(0, 0);
    for (let offset = 0; ; offset += chunkSize) {
      const response = await this.readMediaChunk(uri, offset, chunkSize);
      if (!Number.isSafeInteger(response.sizeBytes) || response.sizeBytes < -1) {
        throw new Error('Selected media returned invalid metadata');
      }
      metadata ||= {
        name: response.name,
        mimeType: response.mimeType,
        // Android providers commonly use -1 for an unknown OpenableColumns.SIZE.
        // Treat it like zero and stream until the native reader reports EOF.
        sizeBytes: Math.max(0, response.sizeBytes),
      };
      if (response.base64Data.length > Math.ceil(chunkSize * 4 / 3) + 8) {
        throw new Error('Selected media returned an invalid chunk');
      }
      const bytes = await MediaWorkerPool.getInstance().decodeBase64(response.base64Data);
      if ((response.bytesRead !== undefined && response.bytesRead !== bytes.length) || bytes.length > chunkSize) {
        throw new Error('Selected media returned an invalid chunk');
      }
      if (!output) output = new Uint8Array(chunkSize);
      if (loaded + bytes.length > output.length) {
        const next = new Uint8Array(Math.max(loaded + bytes.length, output.length * 2));
        next.set(output.subarray(0, loaded));
        output = next;
      }
      output.set(bytes, loaded);
      loaded += bytes.length;
      onProgress?.(loaded, metadata.sizeBytes);

      const isLast = response.isLast ?? (metadata.sizeBytes > 0 && loaded >= metadata.sizeBytes);
      if (isLast) {
        if (metadata.sizeBytes > 0 && loaded !== metadata.sizeBytes) throw new Error('Selected media ended before all chunks were read');
        break;
      }
      if (bytes.length === 0) throw new Error('Selected media ended before all chunks were read');
      if (offset > Number.MAX_SAFE_INTEGER - chunkSize) throw new Error('Selected media is too large to read');
    }
    if (!metadata || !output) throw new Error('Selected media could not be read');
    return { bytes: output.subarray(0, loaded), name: metadata.name, mimeType: metadata.mimeType };
  }

  public async pickDocuments(): Promise<DeviceMediaItem[]> {
    if (!this.isNative()) return [];
    NativeDeviceMediaBridge.notifyPickerActive(true);
    try {
      const pick = this.adapter?.pickDocuments || NativeDeviceMedia.pickDocuments;
      return this.normalizePickedItems((await pick()).items);
    } finally {
      NativeDeviceMediaBridge.notifyPickerActive(false);
    }
  }

  public async captureMedia(): Promise<DeviceMediaItem[]> {
    if (!this.isNative()) return [];
    NativeDeviceMediaBridge.notifyPickerActive(true);
    try {
      const capture = this.adapter?.captureMedia || NativeDeviceMedia.captureMedia;
      return this.normalizePickedItems((await capture()).items);
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
