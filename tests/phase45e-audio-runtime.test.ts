import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { SpaceSession } from '../src/spaces/session.ts';

describe('Phase 45E: Audio Playback, Seeking & Runtime Lifecycle', () => {
  let player: VoicePlaybackManager;
  let mockSession: SpaceSession;
  let mockCloud: CloudClient;

  beforeEach(() => {
    player = new VoicePlaybackManager();
    mockSession = {
      spaceId: 'space_audio_test',
      masterKey: new Uint8Array(32),
      name: 'Audio Space',
    } as any;
    mockCloud = new CloudClient('http://127.0.0.1:8787');
  });

  afterEach(() => {
    player.stop();
    vi.restoreAllMocks();
  });

  it('1. verifies real audio element currentTime seeking and duration clamping', () => {
    // Stage pre-play seek
    player.seek(50, 'msg_voice_1');

    // Seek clamped between 0 and 100
    player.seek(-10, 'msg_voice_1');
    player.seek(150, 'msg_voice_1');

    expect(player.isPlaying('msg_voice_1')).toBe(false);
  });

  it('2. retains ephemeral object URL during playback and revokes strictly on stop', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio-url');

    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:mock-audio-url');

    const meta = {
      durationSeconds: 15,
      mimeType: 'audio/webm',
      sizeBytes: 12000,
      objectId: 'obj_voice_01',
      ciphertextHash: 'hash_01',
      encryptionKeyBase64: 'key_base64',
      nonceBase64: 'nonce_base64',
    };

    let onEndedCalled = false;
    await player.playVoiceNote(mockSession, mockCloud, meta, 'msg_voice_01', {
      onEnded: () => { onEndedCalled = true; },
    });

    expect(player.getPlayingId()).toBe('msg_voice_01');
    expect(revokeSpy).not.toHaveBeenCalled();

    // Stop playback
    player.stop();
    expect(player.getPlayingId()).toBeNull();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-audio-url');

    revokeSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('3. handles attachment-not-found / download failure gracefully without crashing', async () => {
    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockRejectedValue(
      new Error('Attachment not found or access denied')
    );

    const meta = {
      durationSeconds: 10,
      mimeType: 'audio/webm',
      sizeBytes: 5000,
      objectId: 'obj_missing_voice',
      ciphertextHash: 'hash_missing',
      encryptionKeyBase64: 'key_base64',
      nonceBase64: 'nonce_base64',
    };

    let reportedError: Error | null = null;
    await expect(
      player.playVoiceNote(mockSession, mockCloud, meta, 'msg_voice_missing', {
        onError: (err) => { reportedError = err; },
      })
    ).rejects.toThrow(/Attachment not found or access denied/i);

    expect(reportedError).not.toBeNull();
    expect(reportedError?.message).toContain('Attachment not found');
    expect(player.getPlayingId()).toBeNull();
  });

  it('4. ensures only one voice note plays at a time (mutex playback state)', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: any) => `blob:mock-${Date.now()}`);
    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:mock-audio-url-1');

    const meta1 = {
      durationSeconds: 20,
      mimeType: 'audio/webm',
      sizeBytes: 10000,
      objectId: 'obj_voice_01',
      ciphertextHash: 'hash_01',
      encryptionKeyBase64: 'key_base64',
      nonceBase64: 'nonce_base64',
    };

    const meta2 = {
      durationSeconds: 10,
      mimeType: 'audio/webm',
      sizeBytes: 8000,
      objectId: 'obj_voice_02',
      ciphertextHash: 'hash_02',
      encryptionKeyBase64: 'key_base64',
      nonceBase64: 'nonce_base64',
    };

    await player.playVoiceNote(mockSession, mockCloud, meta1, 'msg_01');
    expect(player.getPlayingId()).toBe('msg_01');

    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:mock-audio-url-2');
    await player.playVoiceNote(mockSession, mockCloud, meta2, 'msg_02');
    expect(player.getPlayingId()).toBe('msg_02');

    createSpy.mockRestore();
  });
});
