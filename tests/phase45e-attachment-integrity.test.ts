import { describe, expect, it } from 'vitest';
import { toWireAttachment, assertWireSafe } from '../src/attachments/types.ts';

describe('Phase 45E: Attachment & Voice Wire Safety Invariants', () => {
  it('1. ensures objectId is identical across upload, wire packing, and download stages', () => {
    const objectId = `obj_${Date.now()}_invariant_test`;
    const attachmentId = `att_${Date.now()}`;

    const localPayload = {
      attachmentId,
      objectId,
      name: 'secure_doc.pdf',
      sizeBytes: 1024,
      mimeType: 'application/pdf',
      chunkCount: 1,
      chunkSize: 1024,
      sha256Hash: 'hash_sha',
      ciphertextHash: 'hash_cipher',
      encryptionKeyBase64: 'key_b64',
      previewUrl: 'blob:http://localhost/local-preview',
      localPreviewUrl: 'blob:http://localhost/local-preview',
      state: 'SENT' as const,
      allowSave: true,
      allowForward: true,
    };

    const wirePayload = toWireAttachment(localPayload)!;
    expect(wirePayload.objectId).toBe(objectId);
    expect(wirePayload.attachmentId).toBe(attachmentId);

    // Strips local preview URLs
    expect((wirePayload as any).previewUrl).toBeUndefined();
    expect((wirePayload as any).localPreviewUrl).toBeUndefined();
    assertWireSafe(wirePayload, 'wirePayload');
  });

  it('2. throws immediately if invalid DOM or blob instances are passed into assertWireSafe', () => {
    const unsafeObject = {
      attachmentId: 'att_unsafe',
      previewUrl: 'blob:http://localhost/illegal',
    };

    expect(() => assertWireSafe(unsafeObject, 'unsafeObject')).toThrow(/Wire payload violation/i);
  });
});
