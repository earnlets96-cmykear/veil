import { describe, expect, it } from 'vitest';
import { calculateAvatarCropLayout, clampAvatarCropPan } from '../src/ui/utils/avatarCropGeometry.ts';

describe('avatar crop geometry', () => {
  it('fits landscape images to cover the crop window and preserves source aspect ratio', () => {
    const layout = calculateAvatarCropLayout(1600, 900, 260, 1, 0);
    expect(layout.imageWidth).toBeCloseTo(462.22, 1);
    expect(layout.imageHeight).toBeCloseTo(260, 5);
    expect(layout.outputWidth).toBeCloseTo(layout.imageWidth * (512 / 260), 5);
    expect(layout.outputHeight).toBeCloseTo(layout.imageHeight * (512 / 260), 5);
  });

  it('uses the rotated dimensions to fit portrait images without preview/export mismatch', () => {
    const layout = calculateAvatarCropLayout(900, 1600, 260, 1, 90);
    expect(layout.imageWidth).toBeCloseTo(260, 5);
    expect(layout.imageHeight).toBeCloseTo(462.22, 1);
    expect(layout.visibleWidth).toBeCloseTo(462.22, 1);
    expect(layout.visibleHeight).toBeCloseTo(260, 5);
  });

  it('limits panning so the crop aperture never exposes empty space', () => {
    const layout = calculateAvatarCropLayout(1600, 900, 260, 1, 0);
    const pan = clampAvatarCropPan({ x: 999, y: -999 }, layout);
    expect(pan.x).toBeCloseTo(101.11, 2);
    expect(pan.y).toBeCloseTo(0);
  });
});
