export interface AvatarCropLayout {
  imageWidth: number;
  imageHeight: number;
  visibleWidth: number;
  visibleHeight: number;
  outputWidth: number;
  outputHeight: number;
  maxPanX: number;
  maxPanY: number;
}

/** Shared source-to-preview/export geometry for the circular avatar cropper. */
export function calculateAvatarCropLayout(
  sourceWidth: number,
  sourceHeight: number,
  cropSize: number,
  zoom = 1,
  rotation = 0,
  outputSize = 512
): AvatarCropLayout {
  if (sourceWidth <= 0 || sourceHeight <= 0 || cropSize <= 0 || zoom <= 0 || outputSize <= 0) {
    throw new Error('Avatar crop dimensions, zoom, and output size must be positive');
  }

  const quarterTurn = Math.abs(rotation % 180) === 90;
  const rotatedWidth = quarterTurn ? sourceHeight : sourceWidth;
  const rotatedHeight = quarterTurn ? sourceWidth : sourceHeight;
  const baseScale = Math.max(cropSize / rotatedWidth, cropSize / rotatedHeight);
  const imageWidth = sourceWidth * baseScale * zoom;
  const imageHeight = sourceHeight * baseScale * zoom;
  const visibleWidth = rotatedWidth * baseScale * zoom;
  const visibleHeight = rotatedHeight * baseScale * zoom;
  const outputScale = outputSize / cropSize;

  return {
    imageWidth,
    imageHeight,
    visibleWidth,
    visibleHeight,
    outputWidth: imageWidth * outputScale,
    outputHeight: imageHeight * outputScale,
    maxPanX: Math.max(0, (visibleWidth - cropSize) / 2),
    maxPanY: Math.max(0, (visibleHeight - cropSize) / 2),
  };
}

export function clampAvatarCropPan(
  pan: { x: number; y: number },
  layout: Pick<AvatarCropLayout, 'maxPanX' | 'maxPanY'>
): { x: number; y: number } {
  return {
    x: Math.max(-layout.maxPanX, Math.min(layout.maxPanX, pan.x)),
    y: Math.max(-layout.maxPanY, Math.min(layout.maxPanY, pan.y)),
  };
}
