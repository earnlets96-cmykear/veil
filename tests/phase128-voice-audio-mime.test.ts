import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';

describe('Phase 128: voice playback MIME recovery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the voice metadata MIME type when a cached entry has a generic type', async () => {
    vi.spyOn(MediaCache, 'getOrFetch').mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'application/octet-stream',
      sizeBytes: 3,
    } as any);

    let createdBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      createdBlob = blob as Blob;
      return 'blob:voice-mime-test';
    });

    await VoiceRecorder.downloadAndDecryptVoiceNote(
      { spaceId: 'space_audio_mime', masterKey: new Uint8Array(32), name: 'Audio' } as any,
      {} as any,
      {
        durationSeconds: 3,
        mimeType: 'audio/webm;codecs=opus',
        sizeBytes: 3,
        objectId: 'voice_mime_object',
        ciphertextHash: 'hash',
        encryptionKeyBase64: 'key',
        nonceBase64: '',
      },
    );

    expect(createdBlob?.type).toBe('audio/webm;codecs=opus');
  });
});
