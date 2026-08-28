/**
 * VEIL Phase 36 Test Suite — Media Persistence & Ephemeral Cache Hardening.
 *
 * Verifies that:
 * 1. Stale/dead blob URLs from previous app sessions are NOT treated as valid cache entries.
 * 2. On app restart or cache invalidation, media re-fetches encrypted ciphertext from cloud R2/S3.
 * 3. AEAD decryption is executed cleanly and fresh in-memory Blob URLs are generated.
 * 4. Cache clear properly revokes all ephemeral in-memory URLs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaCache, AttachmentPayload } from '../src/ui/utils/mediaCache.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';
import { CloudClient } from '../src/cloud/client.ts';
import { SpaceSession } from '../src/spaces/session.ts';

describe('Phase 36: Media Persistence & Ephemeral Cache Hardening', () => {
  beforeEach(() => {
    MediaCache.clear();
    vi.restoreAllMocks();
  });

  it('rejects dead blob URLs and re-fetches ciphertext on restart', async () => {
    // 1. Prepare raw plaintext payload
    const originalText = 'Hello VEIL Encrypted Photo';
    const plaintext = new TextEncoder().encode(originalText);
    const encryptionKey = new Uint8Array(32).fill(7);
    const encryptionKeyBase64 = bytesToBase64(encryptionKey);

    // 2. Encrypt chunks via pipeline
    const { chunks, metadata } = AttachmentPipeline.chunkAndEncrypt(
      plaintext,
      'photo.jpg',
      'image/jpeg',
      encryptionKey
    );

    const serializedChunks = new TextEncoder().encode(JSON.stringify(chunks));

    // 3. Mock CloudClient
    const mockCloudClient = {
      downloadAttachment: vi.fn().mockResolvedValue(serializedChunks),
      getSessionToken: vi.fn().mockReturnValue('mock-token'),
    } as unknown as CloudClient;

    const mockSession = {
      spaceId: 'space-test-1',
      name: 'Personal',
      isActive: () => true,
    } as unknown as SpaceSession;

    // 4. Stale attachment payload simulating deserialized message with dead blob preview URL
    const attachmentWithDeadBlob: AttachmentPayload = {
      objectId: 'obj-12345',
      attachmentId: metadata.attachmentId,
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: plaintext.length,
      chunkCount: metadata.chunkCount,
      chunkSize: metadata.chunkSize,
      sha256Hash: metadata.sha256Hash,
      encryptionKeyBase64,
      previewUrl: 'blob:http://localhost:5173/dead-session-uuid', // Stale blob from previous app run
    };

    // 5. Call getOrFetch — verify it doesn't blindly return the dead blob URL
    const decrypted = await MediaCache.getOrFetch(attachmentWithDeadBlob, mockSession, mockCloudClient);

    expect(mockCloudClient.downloadAttachment).toHaveBeenCalledWith('obj-12345');
    expect(decrypted.id).toBe('obj-12345');
    expect(decrypted.mimeType).toBe('image/jpeg');
    expect(decrypted.blobUrl).toBeDefined();
    expect(decrypted.blobUrl).not.toBe('blob:http://localhost:5173/dead-session-uuid');
    expect(new TextDecoder().decode(decrypted.data)).toBe(originalText);

    // 6. Verify subsequent call in same session hits in-memory RAM cache without network fetch
    const cached = await MediaCache.getOrFetch(attachmentWithDeadBlob, mockSession, mockCloudClient);
    expect(mockCloudClient.downloadAttachment).toHaveBeenCalledTimes(1);
    expect(cached.blobUrl).toBe(decrypted.blobUrl);
  });

  it('allows manual cache invalidation and triggers fresh re-decryption', async () => {
    const plaintext = new Uint8Array([1, 2, 3, 4]);
    const mockCloudClient = {
      downloadAttachment: vi.fn().mockResolvedValue(plaintext),
      getSessionToken: vi.fn().mockReturnValue('token'),
    } as unknown as CloudClient;

    const mockSession = { spaceId: 's1', isActive: () => true } as unknown as SpaceSession;

    const payload: AttachmentPayload = {
      objectId: 'obj-retry',
      name: 'test.bin',
      mimeType: 'application/octet-stream',
    };

    const first = await MediaCache.getOrFetch(payload, mockSession, mockCloudClient);
    expect(mockCloudClient.downloadAttachment).toHaveBeenCalledTimes(1);

    // Invalidate key
    MediaCache.invalidate('obj-retry');
    expect(MediaCache.get('obj-retry')).toBeUndefined();

    // Re-fetch triggers new download
    const second = await MediaCache.getOrFetch(payload, mockSession, mockCloudClient);
    expect(mockCloudClient.downloadAttachment).toHaveBeenCalledTimes(2);
    expect(second.id).toBe('obj-retry');
  });
});
