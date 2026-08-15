import { describe, it, expect } from 'vitest';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { getRandomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Media Chunking & Stream Integrity Tests', () => {
  it('should detect and reject reordered chunks, duplicated chunks, and cross-file chunk substitution', () => {
    const file1Plain = getRandomBytes(1024 * 150); // ~3 chunks at 64KiB
    const file2Plain = getRandomBytes(1024 * 150);

    const pkg1 = MediaEncryptor.encryptMedia(file1Plain, { filename: 'file1.bin', mimeType: 'application/octet-stream', sizeBytes: file1Plain.length });
    const pkg2 = MediaEncryptor.encryptMedia(file2Plain, { filename: 'file2.bin', mimeType: 'application/octet-stream', sizeBytes: file2Plain.length });

    expect(pkg1.chunks.length).toBe(3);

    const attachment1 = {
      mediaId: pkg1.mediaId,
      mediaKey: pkg1.mediaKey,
      plaintextDigest: pkg1.plaintextDigest,
      encryptedMetadata: pkg1.encryptedMetadata,
      metadataNonce: pkg1.metadataNonce,
      totalSize: pkg1.totalSize,
      chunkCount: pkg1.chunkCount,
      chunkSize: pkg1.chunkSize,
    };

    // 1. Reordered chunks: [0, 2, 1]
    const reorderedChunks = [pkg1.chunks[0], pkg1.chunks[2], pkg1.chunks[1]];
    expect(() => MediaEncryptor.decryptMedia(attachment1, reorderedChunks)).toThrow(/reordering or missing chunk/);

    // 2. Duplicated chunks: [0, 1, 1]
    const duplicatedChunks = [pkg1.chunks[0], pkg1.chunks[1], pkg1.chunks[1]];
    expect(() => MediaEncryptor.decryptMedia(attachment1, duplicatedChunks)).toThrow(/reordering or missing chunk/);

    // 3. Cross-file chunk substitution: replace chunk 1 of file1 with chunk 1 of file2
    const substitutedChunks = [
      pkg1.chunks[0],
      { ...pkg2.chunks[1], chunkIndex: 1, totalChunks: 3 },
      pkg1.chunks[2],
    ];
    expect(() => MediaEncryptor.decryptMedia(attachment1, substitutedChunks)).toThrow();
  });
});
