import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';
import type { VoiceRecordingMetadata } from '../src/attachments/voiceRecorder.ts';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';

vi.mock('../src/ui/utils/mediaCache.ts', () => ({
  MediaCache: { getOrFetch: vi.fn() },
}));

const root = process.cwd();

describe('mobile shell, voice decryption, and chat row menu regressions', () => {
  beforeEach(() => {
    vi.mocked(MediaCache.getOrFetch).mockReset();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice-test');
  });

  afterEach(() => vi.restoreAllMocks());

  it('decrypts voice chunks with the attachment ID even when the cloud object ID differs', async () => {
    const voiceAttachmentId = 'voice_attachment_id';
    const objectId = 'obj_cloud_storage_id';
    const key = new Uint8Array(32).fill(7);
    const audio = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      audio,
      'voice_test.ogg',
      'audio/ogg',
      key,
      undefined,
      voiceAttachmentId
    );
    const cloudClient = {
      downloadAttachment: vi.fn(async () => new TextEncoder().encode(JSON.stringify(chunks))),
    } as any;
    const meta: VoiceRecordingMetadata = {
      durationSeconds: 1,
      mimeType: 'audio/ogg',
      sizeBytes: audio.length,
      objectId,
      attachmentId: voiceAttachmentId,
      ciphertextHash: 'hash',
      encryptionKeyBase64: bytesToBase64(key),
      nonceBase64: '',
      chunkCount: metadata.chunkCount,
      chunkSize: metadata.chunkSize,
      sha256Hash: metadata.sha256Hash,
    };
    vi.mocked(MediaCache.getOrFetch).mockRejectedValue(new Error('force direct decrypt fallback'));

    await expect(VoiceRecorder.downloadAndDecryptVoiceNote({ spaceId: 'space-test' } as any, cloudClient, meta))
      .resolves.toBe('blob:voice-test');
    expect(cloudClient.downloadAttachment).toHaveBeenCalledWith(objectId, undefined);
  });

  it('passes the cryptographic attachment ID to the media cache, not the storage object ID', async () => {
    const meta: VoiceRecordingMetadata = {
      durationSeconds: 1,
      mimeType: 'audio/ogg',
      sizeBytes: 3,
      objectId: 'obj-cloud',
      attachmentId: 'voice-aad-id',
      ciphertextHash: 'hash',
      encryptionKeyBase64: 'key',
      nonceBase64: '',
    };
    vi.mocked(MediaCache.getOrFetch).mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/ogg',
      blobUrl: 'blob:cached',
    } as any);

    await VoiceRecorder.downloadAndDecryptVoiceNote({ spaceId: 'space-test' } as any, {} as any, meta);
    expect(vi.mocked(MediaCache.getOrFetch).mock.calls[0][0]).toMatchObject({ attachmentId: 'voice-aad-id' });
  });

  it('offsets fixed mobile home and chat views below the Android status bar inset', () => {
    const css = readFileSync(`${root}/src/styles/veil-design-system.css`, 'utf8');
    expect(css).toContain('inset: var(--veil-safe-top) 0 var(--veil-safe-bottom);');
    expect(css).toContain('top: var(--veil-safe-top);');
  });

  it('closes chat row actions on an outside pointer/touch and Escape', () => {
    const sidebar = readFileSync(`${root}/src/ui/components/Sidebar.tsx`, 'utf8');
    expect(sidebar).toContain("document.addEventListener('pointerdown', handleOutsidePointerDown, true)");
    expect(sidebar).toContain('menuRef.current?.contains(target)');
    expect(sidebar).toContain("window.addEventListener('keydown', handleMenuKeyDown)");
  });
});
