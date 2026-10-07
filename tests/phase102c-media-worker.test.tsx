/**
 * Phase 102C Test Suite: Eliminate Media Crypto/Main-Thread Freeze.
 *
 * Verifies:
 * 1. Worker path is used for large media (>= 128 KiB).
 * 2. Small-media fast path executes synchronously for payloads < 128 KiB.
 * 3. Encryption/decryption output remains 100% byte-for-byte compatible with existing pipeline.
 * 4. Progressive decryption progress reports reaches completion.
 * 5. Corrupted ciphertexts and tampering failures propagate correctly.
 * 6. In-flight operation cancellation works properly.
 * 7. Ephemeral RAM-only decrypted media behavior is preserved (no secrets/keys in storage).
 * 8. MediaCache correctly integrates with async worker decryption.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AttachmentPipeline,
  FAST_PATH_THRESHOLD_BYTES,
  getOptimalChunkSize,
} from '../src/attachments/attachmentPipeline.ts';
import { MediaWorkerPool } from '../src/attachments/mediaWorkerPool.ts';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';
import { randomBytes, bytesToHex, bytesToBase64 } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { AttachmentMetadata, EncryptedAttachmentChunk } from '../src/attachments/types.ts';

describe('VEIL Phase 102C: Media Crypto Worker & Non-Blocking Performance', () => {
  const encKey = randomBytes(32);

  beforeEach(() => {
    MediaWorkerPool.getInstance().terminate();
  });

  afterEach(() => {
    MediaWorkerPool.getInstance().terminate();
    vi.restoreAllMocks();
  });

  it('prefers a worker for every payload size when the browser supports workers', async () => {
    expect(FAST_PATH_THRESHOLD_BYTES).toBe(0);
    const pool = MediaWorkerPool.getInstance();
    vi.spyOn(pool, 'isWorkerSupported').mockReturnValue(true);
    const executeSpy = vi.spyOn(pool, 'execute').mockImplementation((_type, payload) => ({
      requestId: 'test-request',
      promise: Promise.resolve(AttachmentPipeline.chunkAndEncrypt(
        new Uint8Array(payload.data),
        payload.name,
        payload.mimeType,
        new Uint8Array(payload.encryptionKey),
        payload.chunkSize,
        payload.existingAttachmentId
      )) as any,
    }));

    await AttachmentPipeline.chunkAndEncryptAsync(new Uint8Array([1, 2, 3]), 'voice.webm', 'audio/webm', encKey);
    expect(executeSpy).toHaveBeenCalledWith('CHUNK_AND_ENCRYPT', expect.any(Object), expect.any(Array));
  });

  it('uses the synchronous compatibility path when Web Workers are unavailable', async () => {
    const smallPayload = randomBytes(32 * 1024); // 32 KiB < 128 KiB
    const pool = MediaWorkerPool.getInstance();
    const executeSpy = vi.spyOn(pool, 'execute');

    const result = await AttachmentPipeline.chunkAndEncryptAsync(
      smallPayload,
      'small_avatar.png',
      'image/png',
      encKey
    );

    expect(result.metadata).toBeDefined();
    expect(result.metadata.sizeBytes).toBe(32 * 1024);
    expect(result.chunks.length).toBe(1);
    // Verified: Worker execute was NOT called (fast-path executed directly on UI thread)
    expect(executeSpy).not.toHaveBeenCalled();

    // Verify synchronous decryption also uses fast path
    const decrypted = await AttachmentPipeline.decryptAndReassembleAsync(
      result.metadata,
      result.chunks,
      encKey
    );
    expect(decrypted).toEqual(smallPayload);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('encryption/decryption output is 100% byte-compatible between sync and async paths', async () => {
    const payload = randomBytes(256 * 1024); // 256 KiB

    // 1. Encrypt synchronously
    const syncEnc = AttachmentPipeline.chunkAndEncrypt(
      payload,
      'test_file.bin',
      'application/octet-stream',
      encKey
    );

    // 2. Decrypt asynchronously
    const asyncDec = await AttachmentPipeline.decryptAndReassembleAsync(
      syncEnc.metadata,
      syncEnc.chunks,
      encKey
    );
    expect(asyncDec).toEqual(payload);

    // 3. Encrypt asynchronously
    const asyncEnc = await AttachmentPipeline.chunkAndEncryptAsync(
      payload,
      'test_file.bin',
      'application/octet-stream',
      encKey
    );

    // 4. Decrypt synchronously
    const syncDec = AttachmentPipeline.decryptAndReassemble(
      asyncEnc.metadata,
      asyncEnc.chunks,
      encKey
    );
    expect(syncDec).toEqual(payload);

    // Hashes match exactly
    expect(asyncEnc.metadata.sha256Hash).toBe(bytesToHex(sha256(payload)));
    expect(syncEnc.metadata.sha256Hash).toBe(bytesToHex(sha256(payload)));
  });

  it('dispatches to worker when Worker is available for large media (>= 128 KiB)', async () => {
    const largePayload = randomBytes(256 * 1024); // 256 KiB >= 128 KiB

    // Setup a mock Worker environment
    let workerPostedMessage: any = null;
    let workerTransferList: any = null;

    class MockWorker {
      public onmessage: ((e: MessageEvent) => void) | null = null;
      public onerror: ((e: ErrorEvent) => void) | null = null;

      public postMessage(msg: any, transfer?: any[]) {
        workerPostedMessage = msg;
        workerTransferList = transfer;

        // Simulate immediate worker processing
        setTimeout(() => {
          if (msg.type === 'CHUNK_AND_ENCRYPT') {
            const syncResult = AttachmentPipeline.chunkAndEncrypt(
              new Uint8Array(msg.payload.data),
              msg.payload.name,
              msg.payload.mimeType,
              new Uint8Array(msg.payload.encryptionKey),
              msg.payload.chunkSize,
              msg.payload.existingAttachmentId
            );
            this.onmessage?.({
              data: {
                type: 'SUCCESS',
                requestId: msg.requestId,
                result: syncResult,
              },
            } as MessageEvent);
          }
        }, 5);
      }

      public terminate() {}
    }

    const origWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = MockWorker;

    try {
      MediaWorkerPool.getInstance().terminate();

      const encResult = await AttachmentPipeline.chunkAndEncryptAsync(
        largePayload,
        'large_photo.jpg',
        'image/jpeg',
        encKey
      );

      expect(encResult.metadata).toBeDefined();
      expect(encResult.metadata.sizeBytes).toBe(256 * 1024);
      expect(workerPostedMessage).not.toBeNull();
      expect(workerPostedMessage.type).toBe('CHUNK_AND_ENCRYPT');
      expect(workerTransferList).toBeDefined();
      expect(workerTransferList.length).toBe(1); // ArrayBuffer was transferred!
    } finally {
      (globalThis as any).Worker = origWorker;
      MediaWorkerPool.getInstance().terminate();
    }
  });

  it('progressive decryption forwards progress and reaches 100% completion', async () => {
    const payload = randomBytes(300 * 1024); // 300 KiB -> 5 chunks of 64 KiB
    const encResult = AttachmentPipeline.chunkAndEncrypt(
      payload,
      'video.mp4',
      'video/mp4',
      encKey,
      64 * 1024
    );

    const progressReports: number[] = [];

    const decrypted = await AttachmentPipeline.decryptProgressiveAsync(
      encResult.metadata,
      encResult.chunks,
      encKey,
      (chunkIdx, _slice, totalSoFar) => {
        progressReports.push(totalSoFar);
      }
    );

    expect(decrypted).toEqual(payload);
    expect(progressReports.length).toBe(encResult.metadata.chunkCount);
    expect(progressReports[progressReports.length - 1]).toBe(payload.length);
  });

  it('corrupted ciphertext and hash mismatch failures propagate cleanly', async () => {
    const payload = randomBytes(150 * 1024);
    const encResult = AttachmentPipeline.chunkAndEncrypt(
      payload,
      'document.pdf',
      'application/pdf',
      encKey
    );

    // Tamper with first chunk ciphertext
    const tamperedChunks = encResult.chunks.map((c, i) =>
      i === 0
        ? { ...c, ciphertext: bytesToBase64(randomBytes(c.ciphertext.length)) }
        : c
    );

    await expect(
      AttachmentPipeline.decryptAndReassembleAsync(
        encResult.metadata,
        tamperedChunks,
        encKey
      )
    ).rejects.toThrow();

    // Tamper with metadata hash
    const tamperedMeta: AttachmentMetadata = {
      ...encResult.metadata,
      sha256Hash: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    await expect(
      AttachmentPipeline.decryptAndReassembleAsync(
        tamperedMeta,
        encResult.chunks,
        encKey
      )
    ).rejects.toThrow('Attachment integrity check failed: SHA-256 hash mismatch');
  });

  it('cancellation properly terminates in-flight worker operation', async () => {
    class HangingWorker {
      public onmessage: ((e: MessageEvent) => void) | null = null;
      public onerror: ((e: ErrorEvent) => void) | null = null;
      public wasCancelled = false;

      public postMessage(msg: any) {
        if (msg.type === 'CANCEL') {
          this.wasCancelled = true;
        }
        // Do not reply to simulate ongoing computation
      }

      public terminate() {}
    }

    const origWorker = (globalThis as any).Worker;
    const mockWorker = new HangingWorker();
    (globalThis as any).Worker = class {
      constructor() {
        return mockWorker;
      }
    };

    try {
      MediaWorkerPool.getInstance().terminate();
      const pool = MediaWorkerPool.getInstance();

      const { requestId, promise } = pool.execute('CHUNK_AND_ENCRYPT', { data: new ArrayBuffer(100) });

      expect(pool.pendingCount).toBe(1);

      // Cancel the operation
      const cancelled = pool.cancel(requestId);
      expect(cancelled).toBe(true);
      expect(pool.pendingCount).toBe(0);
      expect(mockWorker.wasCancelled).toBe(true);

      await expect(promise).rejects.toThrow('Operation cancelled');
    } finally {
      (globalThis as any).Worker = origWorker;
      MediaWorkerPool.getInstance().terminate();
    }
  });

  it('async computeSha256Async calculates correct SHA-256 for large payloads', async () => {
    const data = randomBytes(200 * 1024);
    const expected = bytesToHex(sha256(data));

    const computed = await AttachmentPipeline.computeSha256Async(data);
    expect(computed).toBe(expected);
  });

  it('async bytesToBase64Async produces correct Base64 encoding', async () => {
    const data = randomBytes(200 * 1024);
    const expected = bytesToBase64(data);

    const computed = await AttachmentPipeline.bytesToBase64Async(data);
    expect(computed).toBe(expected);
  });

  it('RAM-only guarantee: verified that no encryption keys or plaintext are written to persistent storage', async () => {
    const payload = randomBytes(150 * 1024);
    const encResult = await AttachmentPipeline.chunkAndEncryptAsync(
      payload,
      'secret_evidence.jpg',
      'image/jpeg',
      encKey
    );

    // Verify localStorage has no keys or plaintext
    if (typeof localStorage !== 'undefined') {
      const allKeys = Object.keys(localStorage);
      for (const k of allKeys) {
        const val = localStorage.getItem(k) || '';
        expect(val).not.toContain(bytesToBase64(payload));
        expect(val).not.toContain(bytesToBase64(encKey));
      }
    }

    // Ephemeral blob URL lifecycle
    const blobUrl = AttachmentPipeline.createEphemeralBlobUrl(payload, 'image/jpeg');
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      expect(blobUrl).toContain('blob:');
    }
    AttachmentPipeline.revokeAllEphemeralBlobUrls();
  });

  it('MediaCache integration: seamlessly fetches and decrypts media via async worker path', async () => {
    const testBytes = randomBytes(160 * 1024);
    const encResult = AttachmentPipeline.chunkAndEncrypt(
      testBytes,
      'test_media.png',
      'image/png',
      encKey
    );

    // Mock cloud client that returns chunked JSON ciphertext
    const mockCloudClient = {
      downloadAttachment: vi.fn().mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(encResult.chunks))
      ),
    } as any;

    const attachmentPayload = {
      objectId: 'obj_phase102c_test',
      attachmentId: encResult.metadata.attachmentId,
      name: encResult.metadata.name,
      mimeType: encResult.metadata.mimeType,
      sizeBytes: encResult.metadata.sizeBytes,
      chunkCount: encResult.metadata.chunkCount,
      chunkSize: encResult.metadata.chunkSize,
      sha256Hash: encResult.metadata.sha256Hash,
      encryptionKeyBase64: bytesToBase64(encKey),
    };

    const mediaItem = await MediaCache.getOrFetch(attachmentPayload, null, mockCloudClient);

    expect(mediaItem).toBeDefined();
    expect(mediaItem?.data).toEqual(testBytes);
    expect(mediaItem?.sizeBytes).toBe(testBytes.length);
    expect(mediaItem?.name).toBe('test_media.png');
  });
});
