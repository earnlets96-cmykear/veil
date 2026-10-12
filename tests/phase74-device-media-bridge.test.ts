import { describe, expect, it, vi } from 'vitest';
import { MediaWorkerPool } from '../src/attachments/mediaWorkerPool.ts';
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

  it('normalizes an unknown size reported by the Android system file picker', async () => {
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      pickDocuments: async () => ({
        items: [{ uri: 'content://provider/audio', name: 'voice.m4a', mimeType: 'audio/mp4', sizeBytes: -1 }],
      }),
    });

    await expect(bridge.pickDocuments()).resolves.toEqual([
      { uri: 'content://provider/audio', name: 'voice.m4a', mimeType: 'audio/mp4', sizeBytes: 0 },
    ]);
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
    const progress: Array<[number, number]> = [];
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

    const file = await bridge.fileFromUri('content://media/large-video', (loadedBytes, totalBytes) => {
      progress.push([loadedBytes, totalBytes]);
    });

    expect(file.size).toBe(nativeBytes.length);
    expect(chunkCalls.length).toBeGreaterThan(1);
    expect(Math.max(...chunkCalls.map((call) => call.length))).toBeLessThanOrEqual(1024 * 1024);
    expect(chunkCalls.map((call) => call.offset)).toEqual([0, 1024 * 1024, 2 * 1024 * 1024]);
    expect(progress).toEqual([
      [0, 0],
      [1024 * 1024, nativeBytes.length],
      [2 * 1024 * 1024, nativeBytes.length],
      [nativeBytes.length, nativeBytes.length],
    ]);
  });

  it('reads a provider selection into one plaintext buffer without constructing an intermediate File', async () => {
    const nativeBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      readMediaChunk: async ({ offset }) => {
        const bytes = nativeBytes.subarray(offset, Math.min(offset + 1024 * 1024, nativeBytes.length));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return {
          name: 'provider.bin',
          mimeType: 'application/octet-stream',
          sizeBytes: nativeBytes.length,
          base64Data: btoa(binary),
          bytesRead: bytes.length,
          isLast: offset + bytes.length >= nativeBytes.length,
        };
      },
    });

    const result = await bridge.bytesFromUri('content://provider/document/7');
    expect(result.name).toBe('provider.bin');
    expect(result.mimeType).toBe('application/octet-stream');
    expect(result.bytes).toEqual(nativeBytes);
  });

  it('routes Android provider chunk decoding through the media worker', async () => {
    const pool = MediaWorkerPool.getInstance();
    const decode = vi.spyOn(pool, 'decodeBase64').mockResolvedValue(new Uint8Array([4, 3, 2, 1]));
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      readMediaChunk: async () => ({
        name: 'audio.m4a',
        mimeType: 'audio/mp4',
        sizeBytes: 4,
        base64Data: 'BAMCAQ==',
        bytesRead: 4,
        isLast: true,
      }),
    });

    const result = await bridge.bytesFromUri('content://provider/audio');

    expect(decode).toHaveBeenCalledWith('BAMCAQ==');
    expect(result.bytes).toEqual(new Uint8Array([4, 3, 2, 1]));
    decode.mockRestore();
  });

  it('supports Android providers that cannot report a size before streaming', async () => {
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      readMediaChunk: async ({ offset }) => ({
        name: 'unknown-size.bin',
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        base64Data: offset === 0 ? 'AQID' : '',
        bytesRead: offset === 0 ? 3 : 0,
        isLast: offset > 0,
      }),
    });

    const result = await bridge.bytesFromUri('content://provider/unknown-size');
    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('treats a negative provider size as unknown and reads the complete audio file', async () => {
    const nativeBytes = new Uint8Array([9, 8, 7, 6]);
    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      readMediaChunk: async ({ offset }) => {
        const bytes = nativeBytes.subarray(offset, Math.min(offset + 1024 * 1024, nativeBytes.length));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return {
          name: 'external-audio.m4a',
          mimeType: 'audio/mp4',
          sizeBytes: -1,
          base64Data: btoa(binary),
          bytesRead: bytes.length,
          isLast: offset + bytes.length >= nativeBytes.length,
        };
      },
    });

    const result = await bridge.bytesFromUri('content://provider/document/audio-unknown-size');
    expect(result.name).toBe('external-audio.m4a');
    expect(result.mimeType).toBe('audio/mp4');
    expect(result.bytes).toEqual(nativeBytes);
  });
});
