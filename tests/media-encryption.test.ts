import { describe, it, expect } from 'vitest';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { getRandomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Media Encryption Tests', () => {
  it('should encrypt and decrypt image, audio, video, and document payloads with unique keys', () => {
    const testCases = [
      { name: 'photo.jpg', mime: 'image/jpeg', size: 1024 * 10 },
      { name: 'voice_note.m4a', mime: 'audio/mp4', size: 1024 * 50 },
      { name: 'clip.mp4', mime: 'video/mp4', size: 1024 * 150 },
      { name: 'report.pdf', mime: 'application/pdf', size: 1024 * 80 },
    ];

    const usedKeys = new Set<string>();

    for (const tc of testCases) {
      const plaintext = getRandomBytes(tc.size);
      const metadata = {
        filename: tc.name,
        mimeType: tc.mime,
        sizeBytes: tc.size,
      };

      const pkg = MediaEncryptor.encryptMedia(plaintext, metadata);

      // Verify unique random keys per media
      expect(usedKeys.has(pkg.mediaKey)).toBe(false);
      usedKeys.add(pkg.mediaKey);

      expect(pkg.mediaId).toMatch(/^med_/);
      expect(pkg.chunks.length).toBeGreaterThan(0);
      expect(pkg.plaintextDigest).toBeTruthy();

      const attachment = {
        mediaId: pkg.mediaId,
        mediaKey: pkg.mediaKey,
        plaintextDigest: pkg.plaintextDigest,
        encryptedMetadata: pkg.encryptedMetadata,
        metadataNonce: pkg.metadataNonce,
        totalSize: pkg.totalSize,
        chunkCount: pkg.chunkCount,
        chunkSize: pkg.chunkSize,
      };

      const decrypted = MediaEncryptor.decryptMedia(attachment, pkg.chunks);
      expect(decrypted.plaintext).toEqual(plaintext);
      expect(decrypted.metadata.filename).toBe(tc.name);
      expect(decrypted.metadata.mimeType).toBe(tc.mime);
      expect(decrypted.metadata.sizeBytes).toBe(tc.size);
    }
  });
});
