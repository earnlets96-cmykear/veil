import { describe, it, expect } from 'vitest';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 24: Realistic Large Encrypted Attachment Tests', () => {
  it('encrypts, chunks, verifies integrity, and decrypts 1 MiB binary payload with ephemeral URL revocation', () => {
    const attachmentKey = randomBytes(32);

    // 1 MiB random binary payload
    const originalBytes = randomBytes(1024 * 1024);

    // 1. Process and encrypt attachment
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      originalBytes,
      'large_document.bin',
      'application/octet-stream',
      attachmentKey
    );
    expect(metadata.name).toBe('large_document.bin');
    expect(metadata.sizeBytes).toBe(originalBytes.length);
    expect(chunks.length).toBeGreaterThan(1);

    // 2. Decrypt attachment
    const decryptedBytes = AttachmentPipeline.decryptAndReassemble(metadata, chunks, attachmentKey);
    expect(decryptedBytes.length).toBe(originalBytes.length);
    expect(decryptedBytes).toEqual(originalBytes);

    // 3. Ephemeral URL revocation
    const blobUrl = AttachmentPipeline.createEphemeralBlobUrl(decryptedBytes, 'application/octet-stream');
    if (blobUrl) {
      expect(blobUrl.startsWith('blob:')).toBe(true);
    }

    AttachmentPipeline.revokeAllEphemeralBlobUrls();
  });

  it('rejects tampered ciphertext during attachment integrity verification', () => {
    const attachmentKey = randomBytes(32);

    const testBytes = new TextEncoder().encode('Confidential Attachment Data');
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      testBytes,
      'secret.txt',
      'text/plain',
      attachmentKey
    );

    // Tamper with chunk ciphertext
    const tamperedChunks = chunks.map((c) => ({
      ...c,
      ciphertext: c.ciphertext.slice(0, -4) + 'AAAA',
    }));

    expect(() => AttachmentPipeline.decryptAndReassemble(metadata, tamperedChunks, attachmentKey)).toThrow();
  });
});
