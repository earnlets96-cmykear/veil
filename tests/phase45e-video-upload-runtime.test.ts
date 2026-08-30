import { describe, expect, it } from 'vitest';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { randomBytes, bytesToBase64, bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { toWireAttachment, assertWireSafe } from '../src/attachments/types.ts';

describe('Phase 45E: Video Upload Pipeline & Object ID Integrity', () => {
  it('1. chunks, encrypts, and validates video payload without leaking local blob URLs on wire', async () => {
    const rawVideoBytes = new Uint8Array(1024 * 100); // 100KB mock video
    rawVideoBytes.fill(7);

    const ephemeralKey = randomBytes(32);
    const attachmentId = `att_video_${Date.now()}`;

    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      rawVideoBytes,
      'hiking_clip.mp4',
      'video/mp4',
      ephemeralKey,
      undefined,
      attachmentId
    );

    expect(metadata.attachmentId).toBe(attachmentId);
    expect(metadata.mimeType).toBe('video/mp4');
    expect(metadata.sizeBytes).toBe(rawVideoBytes.length);
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const rawCiphertext = new TextEncoder().encode(JSON.stringify(chunks));
    const ciphertextHash = bytesToHex(sha256(rawCiphertext));

    const simulatedObjectId = `obj_vid_${Date.now()}`;

    // Sender-side local attachment with ephemeral preview
    const senderLocalAttachment = {
      attachmentId: metadata.attachmentId,
      objectId: simulatedObjectId,
      name: metadata.name,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      chunkCount: metadata.chunkCount,
      chunkSize: metadata.chunkSize,
      sha256Hash: metadata.sha256Hash,
      ciphertextHash,
      encryptionKeyBase64: bytesToBase64(ephemeralKey),
      previewUrl: 'blob:http://localhost/local-preview-only',
      localPreviewUrl: 'blob:http://localhost/local-preview-only',
      state: 'SENT' as const,
      allowSave: true,
      allowForward: true,
    };

    // Serialize to wire attachment payload
    const wireAttachment = toWireAttachment(senderLocalAttachment)!;
    expect(wireAttachment.objectId).toBe(simulatedObjectId);
    expect(wireAttachment.attachmentId).toBe(attachmentId);
    expect(wireAttachment.name).toBe('hiking_clip.mp4');
    expect(wireAttachment.mimeType).toBe('video/mp4');

    // Strict invariant: Wire attachment MUST NOT contain blob: URLs
    expect((wireAttachment as any).previewUrl).toBeUndefined();
    expect((wireAttachment as any).localPreviewUrl).toBeUndefined();
    assertWireSafe(wireAttachment, 'wireAttachment');

    // Recipient decrypts and reconstructs video bytes
    const decryptedBytes = AttachmentPipeline.decryptAndReassemble(
      metadata,
      chunks,
      ephemeralKey
    );

    expect(decryptedBytes.length).toBe(rawVideoBytes.length);
    expect(decryptedBytes[0]).toBe(7);

    // Creates recipient Blob URL
    const recipientBlob = new Blob([decryptedBytes as any], { type: metadata.mimeType });
    expect(recipientBlob.size).toBe(rawVideoBytes.length);
    expect(recipientBlob.type).toBe('video/mp4');
  });

  it('2. verifies object ID consistency across upload, wire envelope, and download', () => {
    const objectId = `obj_${Date.now()}_test_consistency`;
    const attachmentId = `att_${Date.now()}_test`;

    const wire = toWireAttachment({
      attachmentId,
      objectId,
      name: 'movie.mp4',
      sizeBytes: 50000,
      mimeType: 'video/mp4',
      chunkCount: 1,
      chunkSize: 65536,
      sha256Hash: 'hash_sha',
      ciphertextHash: 'hash_cipher',
      encryptionKeyBase64: 'key_b64',
    })!;

    expect(wire.objectId).toBe(objectId);
    expect(wire.attachmentId).toBe(attachmentId);
  });
});
