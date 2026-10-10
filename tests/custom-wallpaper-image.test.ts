import { describe, expect, it, vi } from 'vitest';
import { normalizeCustomWallpaper, type WallpaperImageRuntime } from '../src/ui/utils/customWallpaperImage.ts';

function runtime(width: number, height: number): WallpaperImageRuntime {
  return {
    decode: vi.fn(async () => ({ width, height, close: vi.fn() })),
    createCanvas: vi.fn((canvasWidth, canvasHeight) => ({
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (done) => done(new Blob(['encoded image'], { type: 'image/webp' })),
      width: canvasWidth,
      height: canvasHeight,
    })),
  };
}

describe('custom wallpaper image normalization', () => {
  it('re-encodes accepted images to WebP and scales the longest edge to 2400px', async () => {
    const imageRuntime = runtime(4800, 2400);
    const result = await normalizeCustomWallpaper(new File(['source'], 'photo.jpg', { type: 'image/jpeg' }), imageRuntime);
    expect(result.type).toBe('image/webp');
    expect(imageRuntime.createCanvas).toHaveBeenCalledWith(2400, 1200);
  });

  it('rejects SVG uploads', async () => {
    await expect(normalizeCustomWallpaper(new File(['<svg/>'], 'wallpaper.svg', { type: 'image/svg+xml' }), runtime(1, 1)))
      .rejects.toThrow(/JPEG, PNG, or WebP/);
  });

  it('rejects images that decode above 40 megapixels', async () => {
    await expect(normalizeCustomWallpaper(new File(['source'], 'large.png', { type: 'image/png' }), runtime(8000, 6000)))
      .rejects.toThrow(/40 megapixels/);
  });

  it('rejects source files larger than 15 MiB before decoding', async () => {
    const imageRuntime = runtime(1, 1);
    const file = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'large.webp', { type: 'image/webp' });
    await expect(normalizeCustomWallpaper(file, imageRuntime)).rejects.toThrow(/15 MiB/);
    expect(imageRuntime.decode).not.toHaveBeenCalled();
  });
});
