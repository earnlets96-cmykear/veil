import { describe, it, expect } from 'vitest';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';

describe('VEIL Phase 9 Red-Team Audit: Media Pipeline & Chunk Tampering', () => {
  it('CHUNK SWAPPING ATTACK: Replaces a chunk in Media A with a chunk from Media B', () => {
    const fileA = new Uint8Array(100 * 1024);
    fileA.fill(0x11);
    const pkgA = MediaEncryptor.encryptMedia(fileA, { filename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: fileA.length });

    const fileB = new Uint8Array(100 * 1024);
    fileB.fill(0x22);
    const pkgB = MediaEncryptor.encryptMedia(fileB, { filename: 'b.jpg', mimeType: 'image/jpeg', sizeBytes: fileB.length });

    // Attempt to swap chunk 0 of Media B into Media A
    const tamperedChunks = [pkgB.chunks[0], pkgA.chunks[1]];

    expect(() => {
      MediaEncryptor.decryptMedia(
        {
          mediaId: pkgA.mediaId,
          mediaKey: pkgA.mediaKey,
          plaintextDigest: pkgA.plaintextDigest,
          encryptedMetadata: pkgA.encryptedMetadata,
          metadataNonce: pkgA.metadataNonce,
          totalSize: pkgA.totalSize,
          chunkCount: pkgA.chunkCount,
          chunkSize: pkgA.chunkSize,
        },
        tamperedChunks
      );
    }).toThrow();
  });
});
