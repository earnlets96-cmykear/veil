import { describe, expect, it, vi } from 'vitest';
import { FileSaver } from '../src/ui/utils/fileSaver.ts';
import { NativeDeviceMediaBridge } from '../src/media/NativeDeviceMediaBridge.ts';

describe('Phase 74: gallery saving', () => {
  it('routes native image save through the MediaStore bridge only when save is requested', async () => {
    const saveToGallery = vi.fn(async () => ({ uri: 'content://gallery/1', location: 'Pictures/VEIL' }));
    const bridge = NativeDeviceMediaBridge.createForTesting({ isNative: () => true, saveToGallery });
    FileSaver.setDeviceMediaBridgeForTesting(bridge);

    await expect(FileSaver.saveToGallery({ filename: 'photo.jpg', mimeType: 'image/jpeg', data: new Uint8Array([1, 2]) })).resolves.toMatchObject({
      success: true,
      location: 'Pictures/VEIL',
    });
    expect(saveToGallery).toHaveBeenCalledTimes(1);
  });
});
