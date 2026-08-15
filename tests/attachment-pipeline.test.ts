import { describe, it, expect } from 'vitest';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 15: Encrypted Attachment Pipeline Tests', () => {
  it('CHUNKING & REASSEMBLY: Chunks, encrypts, and successfully decrypts with SHA-256 validation', () => {
    const key = randomBytes(32);
    // Create 150 KiB test buffer (spans multiple 64 KiB chunks)
    const testData = new Uint8Array(150 * 1024);
    for (let i = 0; i < testData.length; i++) testData[i] = i % 256;

    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      testData,
      'report.pdf',
      'application/pdf',
      key,
      64 * 1024
    );

    expect(metadata.chunkCount).toBe(3);
    expect(chunks).toHaveLength(3);

    // Decrypt and reassemble
    const decrypted = AttachmentPipeline.decryptAndReassemble(metadata, chunks, key);
    expect(decrypted.length).toBe(testData.length);
    expect(decrypted).toEqual(testData);
  });

  it('TAMPERED CHUNK REJECTION: Corrupted chunk ciphertext fails decryption', () => {
    const key = randomBytes(32);
    const testData = new Uint8Array(20 * 1024);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      testData,
      'photo.jpg',
      'image/jpeg',
      key
    );

    // Tamper with chunk ciphertext
    const corruptedChunks = [...chunks];
    corruptedChunks[0] = { ...corruptedChunks[0], ciphertext: 'AAAA' + corruptedChunks[0].ciphertext.slice(4) };

    expect(() => {
      AttachmentPipeline.decryptAndReassemble(metadata, corruptedChunks, key);
    }).toThrow();
  });
});
