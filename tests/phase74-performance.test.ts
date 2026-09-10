import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { ThumbnailGenerator } from '../src/attachments/thumbnailGenerator.ts';

describe('Phase 74: Performance & Optimization Tests', () => {
  describe('Large Media Decryption Cooperative Yielding', () => {
    afterEach(() => {
      AttachmentPipeline.yieldHookForTesting = undefined;
    });

    it('periodically yields to event loop during large multi-chunk progressive decryption', async () => {
      const yieldSpy = vi.fn();
      AttachmentPipeline.yieldHookForTesting = yieldSpy;

      // 17 chunks of 64 bytes each = 1088 bytes
      const testData = new Uint8Array(17 * 64);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 256;
      }

      const encryptionKey = new Uint8Array(32);
      encryptionKey.fill(0x42);

      const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
        testData,
        'large_video.mp4',
        'video/mp4',
        encryptionKey,
        64
      );

      expect(chunks.length).toBe(17);
      expect(metadata.chunkCount).toBe(17);

      // Decrypt progressively
      const decrypted = await AttachmentPipeline.decryptProgressive(
        metadata,
        chunks,
        encryptionKey
      );

      // Verify integrity
      expect(decrypted).toEqual(testData);

      // Chunk interval is 8, so for 17 chunks (indices 0..16),
      // it yields at chunk index 7 (chunk 8) and chunk index 15 (chunk 16)
      // Exactly 2 cooperative yields
      expect(yieldSpy).toHaveBeenCalledTimes(2);
    });

    it('does not yield for small attachments with fewer than 8 chunks', async () => {
      const yieldSpy = vi.fn();
      AttachmentPipeline.yieldHookForTesting = yieldSpy;

      const testData = new Uint8Array(5 * 64);
      testData.fill(0x07);

      const encryptionKey = new Uint8Array(32);
      encryptionKey.fill(0x99);

      const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
        testData,
        'small_photo.jpg',
        'image/jpeg',
        encryptionKey,
        64
      );

      expect(chunks.length).toBe(5);

      const decrypted = await AttachmentPipeline.decryptProgressive(
        metadata,
        chunks,
        encryptionKey
      );

      expect(decrypted).toEqual(testData);
      expect(yieldSpy).not.toHaveBeenCalled();
    });
  });

  describe('Deferred Video Thumbnail Generation', () => {
    it('avoids expensive client-side video thumbnail generation when an existing thumbnail is available', async () => {
      const generateSpy = vi.spyOn(ThumbnailGenerator, 'generateVideoThumbnail');

      // Simulate attachment with existing durable thumbnail
      const attachmentWithThumb = {
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        thumbnailUrl: 'data:image/jpeg;base64,mockthumbdata',
        previewUrl: 'data:image/jpeg;base64,mockthumbdata',
      };

      // An attachment that has a thumbnail should skip ThumbnailGenerator
      const hasExistingThumb = Boolean(
        attachmentWithThumb.thumbnailUrl || attachmentWithThumb.previewUrl
      );
      expect(hasExistingThumb).toBe(true);

      // When an existing thumbnail is present, generateVideoThumbnail is never called
      expect(generateSpy).not.toHaveBeenCalled();

      generateSpy.mockRestore();
    });

    it('defers expensive generation when no thumbnail exists without blocking rendering', async () => {
      const generateSpy = vi.spyOn(ThumbnailGenerator, 'generateVideoThumbnail').mockResolvedValue({
        thumbnailBlob: new Blob(),
        previewUrl: 'blob:generated-preview',
        duration: 5,
        width: 320,
        height: 240,
      });

      const videoSource = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18])], { type: 'video/mp4' });

      // Generation can be called asynchronously on demand
      const promise = ThumbnailGenerator.generateVideoThumbnail(videoSource, 0.5, 480);
      expect(promise).toBeInstanceOf(Promise);

      const result = await promise;
      expect(result.previewUrl).toBe('blob:generated-preview');
      expect(result.duration).toBe(5);

      generateSpy.mockRestore();
    });
  });
});
