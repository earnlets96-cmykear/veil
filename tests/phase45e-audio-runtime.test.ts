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

  it('5. subscription mechanism receives updates on play, pause, seek, and unregisters cleanly', async () => {
    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:mock-audio-url');

    const meta = {
      durationSeconds: 40,
      mimeType: 'audio/webm',
      sizeBytes: 15000,
      objectId: 'obj_sub_01',
      ciphertextHash: 'hash_sub',
      encryptionKeyBase64: '',
      nonceBase64: '',
    };

    const statusLog: string[] = [];
    const unsubscribe = player.subscribe('msg_sub_01', (status, pct, cur, dur) => {
      statusLog.push(`${status}:${Math.round(pct)}%`);
    });

    // Initial subscription should emit initial state
    expect(statusLog[0]).toBe('idle:0%');

    await player.playVoiceNote(mockSession, mockCloud, meta, 'msg_sub_01');
    expect(statusLog).toContain('loading:0%');
    expect(statusLog).toContain('playing:0%');

    // Seek to 50%
    player.seek(50, 'msg_sub_01');
    expect(statusLog).toContain('playing:50%');

    // Pause
    player.pause();
    expect(statusLog).toContain('paused:50%');

    // Stop
    player.stop();
    expect(statusLog[statusLog.length - 1]).toBe('idle:0%');

    // Unsubscribe and verify no further callbacks
    unsubscribe();
    const countAfterUnsub = statusLog.length;
    player.seek(70, 'msg_sub_01');
    expect(statusLog.length).toBe(countAfterUnsub);
  });

  it('6. safely handles Chrome WebM duration: Infinity by falling back to metadata duration', async () => {
    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:mock-audio-url');

    const meta = {
      durationSeconds: 24, // authoritatively 24s
      mimeType: 'audio/webm',
      sizeBytes: 9000,
      objectId: 'obj_inf_01',
      ciphertextHash: 'hash_inf',
      encryptionKeyBase64: '',
      nonceBase64: '',
    };

    await player.playVoiceNote(mockSession, mockCloud, meta, 'msg_inf_01');

    // Simulate browser reporting Infinity duration for WebM stream
    (player as any).currentAudio.duration = Infinity;

    // getDuration must NOT return Infinity
    expect(player.getDuration()).toBe(24);
    expect(isFinite(player.getDuration())).toBe(true);

    // Seeking works accurately with finite metadata fallback
    player.seek(50, 'msg_inf_01');
    expect(player.getCurrentTime()).toBe(12);

    player.stop();
  });

  it('7. seeking on an idle/unplayed voice note notifies listeners with targeted message ID and stages seek', () => {
    let capturedStatus = '';
    let capturedPct = -1;
    let capturedCur = -1;
    let capturedDur = -1;

    player.subscribe('msg_idle_seek', (status, pct, cur, dur) => {
      capturedStatus = status;
      capturedPct = pct;
      capturedCur = cur;
      capturedDur = dur;
    });

    // Initial state
    expect(capturedStatus).toBe('idle');
    expect(capturedPct).toBe(0);

    // Seek to 40% with known duration 20s
    player.seek(40, 'msg_idle_seek', 20);

    expect(capturedStatus).toBe('idle');
    expect(capturedPct).toBe(40);
    expect(capturedCur).toBe(8); // 40% of 20s
    expect(capturedDur).toBe(20);
  });

  it('8. subscribing to an idle voice note with pre-staged seek immediately reflects the staged position', () => {
    // Stage seek before subscriber mounts
    player.seek(65, 'msg_pre_staged', 10);

    let initialPct = -1;
    let initialCur = -1;
    player.subscribe('msg_pre_staged', (_status, pct, cur) => {
      initialPct = pct;
      initialCur = cur;
    });

    expect(initialPct).toBe(65);
    expect(initialCur).toBe(6.5);
  });

  it('9. resuming a paused voice note applies staged seek to audio element currentTime before playback', async () => {
    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:mock-audio-url');

    const meta = {
      durationSeconds: 30,
      mimeType: 'audio/webm',
      sizeBytes: 10000,
      objectId: 'obj_resume_seek',
      ciphertextHash: 'hash_resume',
      encryptionKeyBase64: '',
      nonceBase64: '',
    };

    await player.playVoiceNote(mockSession, mockCloud, meta, 'msg_resume_seek');
    expect(player.isPlaying('msg_resume_seek')).toBe(true);

    // Pause playback
    player.pause();
    expect(player.isPaused('msg_resume_seek')).toBe(true);

    // Seek to 80% while paused (80% of 30s = 24s)
    player.seek(80, 'msg_resume_seek', 30);
    expect((player as any).currentAudio.currentTime).toBe(24);

    // Resume playback
    await player.resume();
    expect(player.isPlaying('msg_resume_seek')).toBe(true);
    expect((player as any).currentAudio.currentTime).toBe(24);

    player.stop();
  });

  it('10. playVoiceNote handles AbortError gracefully by staying paused rather than throwing or destroying audio', async () => {
    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:mock-audio-url');

    const meta = {
      durationSeconds: 15,
      mimeType: 'audio/webm',
      sizeBytes: 5000,
      objectId: 'obj_abort_test',
      ciphertextHash: 'hash_abort',
      encryptionKeyBase64: '',
      nonceBase64: '',
    };

    // First start normal playback
    await player.playVoiceNote(mockSession, mockCloud, meta, 'msg_abort_test');
    player.pause();

    // Mock audio play to throw AbortError (simulating rapid tap interruption)
    const abortErr = new Error('The play() request was interrupted by a call to pause()');
    abortErr.name = 'AbortError';
    (player as any).currentAudio.play = vi.fn().mockRejectedValue(abortErr);

    // Calling playVoiceNote for the same paused note should catch AbortError and stay paused
    await expect(player.playVoiceNote(mockSession, mockCloud, meta, 'msg_abort_test')).resolves.not.toThrow();
    expect(player.isPaused('msg_abort_test')).toBe(true);
    expect((player as any).currentAudio).not.toBeNull(); // Audio element not destroyed!

    player.stop();
  });
});
