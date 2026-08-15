import { describe, it, expect } from 'vitest';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';

describe('VEIL Phase 8: Media Metadata & Chunk Privacy Tests', () => {
  it('MEDIA METADATA: Media chunks are standardized and contain no plaintext metadata', () => {
    const rawImage = new Uint8Array(100 * 1024); // 100 KB image
    rawImage.fill(0xaa);

    const mediaPkg = MediaEncryptor.encryptMedia(
      rawImage,
      {
        mimeType: 'image/jpeg',
        fileName: 'photo_secret.jpg',
        size: rawImage.length,
        checksum: 'dummy_hash',
      }
    );

    // 1. mediaId is opaque and non-semantic
    expect(mediaPkg.mediaId).toMatch(/^med_[0-9a-zA-Z]+/);
    expect(mediaPkg.mediaId).not.toContain('jpg');
    expect(mediaPkg.mediaId).not.toContain('photo');


    // 2. Chunks are standardized to 64 KiB (except last chunk)
    expect(mediaPkg.chunks.length).toBe(2);
    expect(mediaPkg.chunks[0].chunkIndex).toBe(0);
    expect(mediaPkg.chunks[0].totalChunks).toBe(2);
    expect(mediaPkg.chunks[1].chunkIndex).toBe(1);
    expect(mediaPkg.chunks[1].totalChunks).toBe(2);


    // 3. Encrypted metadata contains the sensitive MIME type and filename, encrypted at rest
    expect(mediaPkg.encryptedMetadata).toBeTruthy();
    expect(mediaPkg.metadataNonce).toBeTruthy();
  });
});

