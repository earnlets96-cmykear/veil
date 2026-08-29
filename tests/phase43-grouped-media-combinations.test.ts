import { describe, it, expect } from 'vitest';
import { LocalAttachmentPayload, toWireAttachments, assertWireSafe } from '../src/attachments/types.ts';

describe('Phase 43: Grouped Media Combinations & Multi-Attachment Protocol Suite', () => {
  const createMockAttachment = (
    id: string,
    mimeType: string,
    state: 'QUEUED' | 'UPLOADING' | 'SENT' | 'FAILED' = 'SENT'
  ): LocalAttachmentPayload => ({
    attachmentId: `att_${id}`,
    objectId: `obj_${id}`,
    name: `file_${id}.${mimeType.includes('video') ? 'mp4' : 'jpg'}`,
    mimeType,
    sizeBytes: 1024 * 100,
    chunkCount: 2,
    chunkSize: 64 * 1024,
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ciphertextHash: 'a'.repeat(64),
    encryptionKeyBase64: 'key_base64_32_bytes_mock',
    previewUrl: `blob:http://localhost:5173/sender-preview-${id}`,
    localPreviewUrl: `blob:http://localhost:5173/sender-preview-${id}`,
    state,
    allowSave: true,
    allowForward: true,
  });

  it('handles combinations: 1 img, 2 imgs, 3 imgs, 4 imgs, 5+ imgs, img+video, video+img+video', () => {
    const testCases = [
      { name: '1 image', atts: [createMockAttachment('1', 'image/jpeg')] },
      { name: '2 images', atts: [createMockAttachment('1', 'image/jpeg'), createMockAttachment('2', 'image/png')] },
      {
        name: '3 images',
        atts: [
          createMockAttachment('1', 'image/jpeg'),
          createMockAttachment('2', 'image/png'),
          createMockAttachment('3', 'image/webp'),
        ],
      },
      {
        name: '4 images',
        atts: [
          createMockAttachment('1', 'image/jpeg'),
          createMockAttachment('2', 'image/png'),
          createMockAttachment('3', 'image/webp'),
          createMockAttachment('4', 'image/gif'),
        ],
      },
      {
        name: '5+ images',
        atts: [
          createMockAttachment('1', 'image/jpeg'),
          createMockAttachment('2', 'image/png'),
          createMockAttachment('3', 'image/webp'),
          createMockAttachment('4', 'image/gif'),
          createMockAttachment('5', 'image/jpeg'),
          createMockAttachment('6', 'image/png'),
        ],
      },
      {
        name: 'image + video',
        atts: [createMockAttachment('1', 'image/jpeg'), createMockAttachment('2', 'video/mp4')],
      },
      {
        name: 'video + image + video',
        atts: [
          createMockAttachment('1', 'video/mp4'),
          createMockAttachment('2', 'image/jpeg'),
          createMockAttachment('3', 'video/webm'),
        ],
      },
    ];

    for (const tc of testCases) {
      const wire = toWireAttachments(tc.atts);
      expect(wire).toBeDefined();
      expect(wire!.length).toBe(tc.atts.length);

      // Verify strict wire isolation
      for (let i = 0; i < wire!.length; i++) {
        expect(wire![i].attachmentId).toBe(tc.atts[i].attachmentId);
        expect(wire![i].objectId).toBe(tc.atts[i].objectId);
        expect(wire![i].mimeType).toBe(tc.atts[i].mimeType);
        expect((wire![i] as any).previewUrl).toBeUndefined();
        expect((wire![i] as any).localPreviewUrl).toBeUndefined();
        expect((wire![i] as any).state).toBeUndefined();
      }

      assertWireSafe(wire, `wire_${tc.name}`);
    }
  });

  it('preserves exact attachment ordering across serialization', () => {
    const list = [
      createMockAttachment('A', 'image/jpeg'),
      createMockAttachment('B', 'video/mp4'),
      createMockAttachment('C', 'image/png'),
    ];

    const serialized = toWireAttachments(list)!;
    expect(serialized.map((a) => a.attachmentId)).toEqual(['att_A', 'att_B', 'att_C']);
  });

  it('isolates individual attachment failures without corrupting successful attachments', () => {
    const mixed = [
      createMockAttachment('1', 'image/jpeg', 'SENT'),
      createMockAttachment('2', 'image/png', 'FAILED'),
      createMockAttachment('3', 'image/webp', 'SENT'),
    ];

    expect(mixed[0].state).toBe('SENT');
    expect(mixed[1].state).toBe('FAILED');
    expect(mixed[2].state).toBe('SENT');

    // Only successful attachments with objectId can be sent
    const successful = mixed.filter((a) => a.state === 'SENT');
    expect(successful.length).toBe(2);
    expect(toWireAttachments(successful)!.length).toBe(2);
  });
});
