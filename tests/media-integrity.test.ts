import { describe, it, expect } from 'vitest';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { getRandomBytes, base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Media Integrity Verification Tests', () => {
  it('should reject corrupted chunk ciphertext, wrong keys, and truncated chunks', () => {
    const plaintext = getRandomBytes(1024 * 100);
    const metadata = { filename: 'secret.png', mimeType: 'image/png', sizeBytes: plaintext.length };

    const pkg = MediaEncryptor.encryptMedia(plaintext, metadata);
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

    // 1. Corrupted ciphertext in chunk 0
    const corruptedChunks = pkg.chunks.map(c => ({ ...c }));
    const rawCipher = base64ToBytes(corruptedChunks[0].ciphertext);
    rawCipher[5] ^= 0xff;
    corruptedChunks[0].ciphertext = bytesToBase64(rawCipher);

    expect(() => MediaEncryptor.decryptMedia(attachment, corruptedChunks)).toThrow();

    // 2. Wrong mediaKey
    const wrongKeyAttachment = {
      ...attachment,
      mediaKey: bytesToBase64(getRandomBytes(32)),
    };
    expect(() => MediaEncryptor.decryptMedia(wrongKeyAttachment, pkg.chunks)).toThrow();

    // 3. Truncated chunks list
    const truncatedChunks = pkg.chunks.slice(0, pkg.chunks.length - 1);
    expect(() => MediaEncryptor.decryptMedia(attachment, truncatedChunks)).toThrow(/Chunk count mismatch/);

    // 4. Digest mismatch (tampered digest claim)
    const tamperedDigestAttachment = {
      ...attachment,
      plaintextDigest: '0000000000000000000000000000000000000000000000000000000000000000',
    };
    expect(() => MediaEncryptor.decryptMedia(tamperedDigestAttachment, pkg.chunks)).toThrow(/digest verification failed/);
  });
});
