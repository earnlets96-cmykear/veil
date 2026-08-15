import { describe, it, expect } from 'vitest';
import { InMemoryMediaRelay } from '../src/media/mediaStorage.ts';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { getRandomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Media Replay & Duplication Tests', () => {
  it('should handle duplicate upload and reject replayed invalid chunk sequences', async () => {
    const relay = new InMemoryMediaRelay();
    const plaintext = getRandomBytes(1024 * 50);
    const pkg = MediaEncryptor.encryptMedia(plaintext, { filename: 'voice.m4a', mimeType: 'audio/mp4', sizeBytes: plaintext.length });
    const token = 'auth_token_xyz';

    await relay.uploadMedia(pkg.mediaId, pkg.chunks, token);

    // Duplicate upload with same token succeeds idempotently
    const duplicateUpload = await relay.uploadMedia(pkg.mediaId, pkg.chunks, token);
    expect(duplicateUpload).toBe(true);

    const downloaded = await relay.downloadMedia(pkg.mediaId, token);
    expect(downloaded).not.toBeNull();
    expect(downloaded!.length).toBe(pkg.chunks.length);
  });
});
