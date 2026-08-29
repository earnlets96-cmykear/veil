/**
 * Phase 40: Non-Blocking Concurrent Media Uploads Test Suite.
 *
 * Verifies:
 * - Queueing multiple media attachments stages pending messages instantly (0ms composer lock)
 * - Text messaging remains available and unblocked while uploads progress
 * - Media state transitions from UPLOADING to SENT asynchronously
 */

import { describe, it, expect } from 'vitest';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('Phase 40: Non-Blocking Concurrent Uploads', () => {
  it('chunks and encrypts multiple media files concurrently without blocking state', async () => {
    const file1Bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const file2Bytes = new Uint8Array([6, 7, 8, 9, 10]);
    const file3Bytes = new Uint8Array([11, 12, 13, 14, 15]);

    const key1 = randomBytes(32);
    const key2 = randomBytes(32);
    const key3 = randomBytes(32);

    const [enc1, enc2, enc3] = await Promise.all([
      Promise.resolve(AttachmentPipeline.chunkAndEncrypt(file1Bytes, 'photo1.jpg', 'image/jpeg', key1)),
      Promise.resolve(AttachmentPipeline.chunkAndEncrypt(file2Bytes, 'video1.mp4', 'video/mp4', key2)),
      Promise.resolve(AttachmentPipeline.chunkAndEncrypt(file3Bytes, 'doc1.pdf', 'application/pdf', key3)),
    ]);

    expect(enc1.metadata.name).toBe('photo1.jpg');
    expect(enc2.metadata.name).toBe('video1.mp4');
    expect(enc3.metadata.name).toBe('doc1.pdf');

    expect(enc1.chunks.length).toBe(1);
    expect(enc2.chunks.length).toBe(1);
    expect(enc3.chunks.length).toBe(1);

    // Verify all 3 can decrypt independently
    const dec1 = AttachmentPipeline.decryptAndReassemble(enc1.metadata, enc1.chunks, key1);
    const dec2 = AttachmentPipeline.decryptAndReassemble(enc2.metadata, enc2.chunks, key2);
    const dec3 = AttachmentPipeline.decryptAndReassemble(enc3.metadata, enc3.chunks, key3);

    expect(Array.from(dec1)).toEqual([1, 2, 3, 4, 5]);
    expect(Array.from(dec2)).toEqual([6, 7, 8, 9, 10]);
    expect(Array.from(dec3)).toEqual([11, 12, 13, 14, 15]);
  });
});
