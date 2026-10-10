import { describe, expect, it } from 'vitest';
import { NativeDeviceMediaBridge } from '../src/media/NativeDeviceMediaBridge.ts';

describe('Phase 74: native device media bridge', () => {
  it('does not request device media access until Recent is explicitly opened', async () => {
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      requestRecentMediaPermission: async () => ({ status: 'granted' as const }),
    });

    expect(bridge.permissionRequestCount()).toBe(0);
    await bridge.requestRecentMediaPermission();
    expect(bridge.permissionRequestCount()).toBe(1);
  });

  it('returns no recent media on web without asking for a permission', async () => {
    const bridge = NativeDeviceMediaBridge.createForTesting({ isNative: () => false });

    await expect(bridge.listRecentMedia({ limit: 60, types: ['image', 'video'] })).resolves.toEqual({ items: [] });
    expect(bridge.permissionRequestCount()).toBe(0);
  });

  it('normalizes native recent media pages into safe attachment metadata', async () => {
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      listRecentMedia: async () => ({
        items: [{ uri: 'content://media/42', name: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 123 }],
        nextCursor: 'next',
      }),
    });

    await expect(bridge.listRecentMedia({ limit: 60, types: ['image', 'video'] })).resolves.toEqual({
      items: [{ uri: 'content://media/42', name: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 123 }],
      nextCursor: 'next',
    });
  });

  it('converts a user-selected native URI into an in-memory File only when explicitly staged', async () => {
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      readMediaChunk: async ({ offset, length }) => ({
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 3,
        base64Data: offset === 0 && length >= 3 ? 'AQID' : '',
      }),
    });

    const file = await bridge.fileFromUri('content://media/42');

    expect(file.name).toBe('photo.jpg');
    expect(file.type).toBe('image/jpeg');
    await expect(file.arrayBuffer()).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer);
  });

  it('creates an immediate metadata-only selection before reading a large video', () => {
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      readMediaChunk: async () => {
        throw new Error('media bytes must not be read to select the item');
      },
    });

    const selection = bridge.createSelectionPlaceholder({
      uri: 'content://media/large-video',
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 80 * 1024 * 1024,
    });

    expect(selection.name).toBe('clip.mp4');
    expect(selection.type).toBe('video/mp4');
    expect(selection.size).toBe(0);
  });

  it('reads large native videos in bounded chunks instead of one full-size Base64 result', async () => {
    const nativeBytes = new Uint8Array(2 * 1024 * 1024 + 5);
    nativeBytes.fill(7);
    const chunkCalls: Array<{ offset: number; length: number }> = [];
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      readMediaChunk: async ({ offset, length }) => {
        chunkCalls.push({ offset, length });
        const bytes = nativeBytes.subarray(offset, Math.min(offset + length, nativeBytes.length));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return {
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          sizeBytes: nativeBytes.length,
          base64Data: btoa(binary),
        };
      },
    });

    const file = await bridge.fileFromUri('content://media/large-video');

    expect(file.size).toBe(nativeBytes.length);
    expect(chunkCalls.length).toBeGreaterThan(1);
    expect(Math.max(...chunkCalls.map((call) => call.length))).toBeLessThanOrEqual(1024 * 1024);
    expect(chunkCalls.map((call) => call.offset)).toEqual([0, 1024 * 1024, 2 * 1024 * 1024]);
  });
});
