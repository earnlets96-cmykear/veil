const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 2400;

export interface DecodedWallpaperImage {
  width: number;
  height: number;
  close(): void;
}

export interface WallpaperCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): { drawImage(image: DecodedWallpaperImage, x: number, y: number, width: number, height: number): void } | null;
  toBlob(callback: (blob: Blob | null) => void, type: string, quality: number): void;
}

export interface WallpaperImageRuntime {
  decode(file: File): Promise<DecodedWallpaperImage>;
  createCanvas(width: number, height: number): WallpaperCanvas;
}

const browserRuntime: WallpaperImageRuntime = {
  decode: (file) => createImageBitmap(file),
  createCanvas: (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
};

export async function normalizeCustomWallpaper(
  file: File,
  imageRuntime: WallpaperImageRuntime = browserRuntime,
): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose an image smaller than 15 MiB.');
  }

  let image: DecodedWallpaperImage | null = null;
  try {
    image = await imageRuntime.decode(file);
    if (!image.width || !image.height || image.width * image.height > MAX_PIXELS) {
      throw new Error('Choose an image no larger than 40 megapixels.');
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = imageRuntime.createCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not process the image.');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((output) => output ? resolve(output) : reject(new Error('This browser could not encode the image.')), 'image/webp', 0.84);
    });
    if (blob.type !== 'image/webp') throw new Error('This browser could not create a safe WebP image.');
    return blob;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('This image could not be processed.');
  } finally {
    image?.close();
  }
}
