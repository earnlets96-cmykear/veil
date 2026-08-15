import { describe, it, expect } from 'vitest';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { getRandomBytes, base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Adversarial Media Corruption Tests', () => {
  it('should detect adversarial bit flips, truncated byte streams, and modified nonces', () => {
    const plaintext = getRandomBytes(1024 * 70); // 2 chunks
    const pkg = MediaEncryptor.encryptMedia(plaintext, { filename: 'doc.pdf', mimeType: 'application/pdf', sizeBytes: plaintext.length });

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

    // 1. Bit flip in chunk 1 ciphertext
    const corruptedChunks1 = pkg.chunks.map(c => ({ ...c }));
    const cipher1 = base64ToBytes(corruptedChunks1[1].ciphertext);
    cipher1[cipher1.length - 1] ^= 0x01;
    corruptedChunks1[1].ciphertext = bytesToBase64(cipher1);
    expect(() => MediaEncryptor.decryptMedia(attachment, corruptedChunks1)).toThrow();

    // 2. Modified nonce in chunk 0
    const corruptedChunks2 = pkg.chunks.map(c => ({ ...c }));
    const nonce0 = base64ToBytes(corruptedChunks2[0].nonce);
    nonce0[0] ^= 0x01;
    corruptedChunks2[0].nonce = bytesToBase64(nonce0);
    expect(() => MediaEncryptor.decryptMedia(attachment, corruptedChunks2)).toThrow();

    // 3. Truncated chunk ciphertext (shortened by 5 bytes)
    const corruptedChunks3 = pkg.chunks.map(c => ({ ...c }));
    const truncatedCipher = base64ToBytes(corruptedChunks3[0].ciphertext).slice(0, -5);
    corruptedChunks3[0].ciphertext = bytesToBase64(truncatedCipher);
    expect(() => MediaEncryptor.decryptMedia(attachment, corruptedChunks3)).toThrow();
  });
});
