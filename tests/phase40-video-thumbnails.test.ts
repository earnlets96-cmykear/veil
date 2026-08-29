/**
 * Phase 40: Client-Side Video Thumbnail Generation Test Suite.
 *
 * Verifies:
 * - ThumbnailGenerator.generateVideoThumbnail extracts video metadata and dimensions
 * - Safe fallback in test / non-DOM environments without crashing
 * - Returns clean Blob and ephemeral preview URL
 */

import { describe, it, expect } from 'vitest';
import { ThumbnailGenerator } from '../src/attachments/thumbnailGenerator.ts';

describe('Phase 40: Video Thumbnail Generator', () => {
  it('generates a thumbnail result object with dimensions and duration', async () => {
    const mockVideoBlob = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])], {
      type: 'video/mp4',
    });

    const result = await ThumbnailGenerator.generateVideoThumbnail(mockVideoBlob, 0.5, 320);

    expect(result).toBeDefined();
    expect(result.thumbnailBlob).toBeInstanceOf(Blob);
    expect(result.previewUrl).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});
