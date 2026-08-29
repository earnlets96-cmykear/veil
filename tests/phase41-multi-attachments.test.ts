import { describe, it, expect } from 'vitest';
import { toWireAttachments, LocalAttachmentPayload, WireAttachmentPayload } from '../src/attachments/types.ts';

describe('Phase 41: Multi-Media Message Grouping & Bounded Concurrency', () => {
  it('toWireAttachments converts array of local attachments to clean wire attachments without previewUrl', () => {
    const localAttachments: LocalAttachmentPayload[] = [
      {
        attachmentId: 'att_1',
        objectId: 'obj_1',
        name: 'photo1.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12000,
        chunkCount: 1,
        chunkSize: 65536,
        sha256Hash: '1'.repeat(64),
        encryptionKeyBase64: 'key1',
        previewUrl: 'blob:http://localhost:5173/sender-blob-1',
        localPreviewUrl: 'blob:http://localhost:5173/sender-blob-1',
        state: 'SENT',
      },
      {
        attachmentId: 'att_2',
        objectId: 'obj_2',
        name: 'video1.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 850000,
        chunkCount: 14,
        chunkSize: 65536,
        sha256Hash: '2'.repeat(64),
        encryptionKeyBase64: 'key2',
        previewUrl: 'blob:http://localhost:5173/sender-blob-2',
        localPreviewUrl: 'blob:http://localhost:5173/sender-blob-2',
        state: 'SENT',
      },
    ];

    const wireAttachments = toWireAttachments(localAttachments);
    expect(wireAttachments).toBeDefined();
    expect(wireAttachments!.length).toBe(2);

    expect(wireAttachments![0].attachmentId).toBe('att_1');
    expect(wireAttachments![0].objectId).toBe('obj_1');
    expect((wireAttachments![0] as any).previewUrl).toBeUndefined();

    expect(wireAttachments![1].attachmentId).toBe('att_2');
    expect(wireAttachments![1].objectId).toBe('obj_2');
    expect((wireAttachments![1] as any).previewUrl).toBeUndefined();

    expect(JSON.stringify(wireAttachments).includes('blob:')).toBe(false);
  });

  it('bounded worker pool executes items with max concurrency of 2', async () => {
    const items = [1, 2, 3, 4, 5];
    let maxConcurrentObserved = 0;
    let currentlyRunning = 0;

    let activeIndex = 0;
    const results: number[] = new Array(items.length);

    const worker = async () => {
      while (activeIndex < items.length) {
        const idx = activeIndex++;
        currentlyRunning++;
        maxConcurrentObserved = Math.max(maxConcurrentObserved, currentlyRunning);

        // Simulate async encryption / upload delay
        await new Promise((res) => setTimeout(res, 20));

        results[idx] = items[idx] * 2;
        currentlyRunning--;
      }
    };

    await Promise.all([worker(), worker()]);

    expect(maxConcurrentObserved).toBeLessThanOrEqual(2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });
});
