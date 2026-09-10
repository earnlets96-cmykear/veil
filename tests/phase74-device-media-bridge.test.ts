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
      readMedia: async () => ({
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 3,
        base64Data: 'AQID',
      }),
    });

    const file = await bridge.fileFromUri('content://media/42');

    expect(file.name).toBe('photo.jpg');
    expect(file.type).toBe('image/jpeg');
    await expect(file.arrayBuffer()).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer);
  });
});
