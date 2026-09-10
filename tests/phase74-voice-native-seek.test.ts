import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { NativeMediaBridge } from '../src/media/NativeMediaBridge.ts';

describe('Phase 74: Native Android Voice Note Authoritative Seeking & Playback', () => {
  let player: VoicePlaybackManager;
  let bridge: NativeMediaBridge;

  beforeEach(() => {
    bridge = NativeMediaBridge.getInstance();
    player = new VoicePlaybackManager();
    (player as any).isNative = true;
  });

  afterEach(() => {
    player.stop();
    vi.restoreAllMocks();
  });

  it('active native playback seek updates position without re-triggering playAudio', async () => {
    const playAudioSpy = vi.spyOn(bridge, 'playAudio').mockResolvedValue(true);
    const seekAudioSpy = vi.spyOn(bridge, 'seekAudio').mockResolvedValue({
      success: true,
      currentPositionMs: 24000,
      durationMs: 60000,
    });

    (player as any).currentPlayingId = 'msg_active_1';
    (player as any).currentStatus = 'playing';
    (player as any).nativeIsPlaying = true;
    (player as any).nativeDuration = 60;
    (player as any).nativeCurrentTime = 5;

    let reportedPercent = 0;
    let reportedCurrentTime = 0;
    let reportedDuration = 0;

    (player as any).activeCallbacks = {
      onProgress: (p: number, ct: number, dur: number) => {
        reportedPercent = p;
        reportedCurrentTime = ct;
        reportedDuration = dur;
      },
    };

    // Seek to 40% (24s of 60s)
    player.seek(40, 'msg_active_1', 60);

    // Wait for async seekNative to complete
    await vi.waitFor(() => {
      expect(seekAudioSpy).toHaveBeenCalledWith(24000);
    });

    expect(playAudioSpy).not.toHaveBeenCalled();
    expect(player.getCurrentTime()).toBe(24);
    expect(reportedCurrentTime).toBe(24);
    expect(reportedPercent).toBe(40);
    expect(reportedDuration).toBe(60);
  });

  it('paused playback seek preserves seeked position and resumes from it', async () => {
    const seekAudioSpy = vi.spyOn(bridge, 'seekAudio').mockResolvedValue({
      success: true,
      currentPositionMs: 15000,
      durationMs: 30000,
    });
    const resumeAudioSpy = vi.spyOn(bridge, 'resumeAudio').mockResolvedValue(true);

    (player as any).currentPlayingId = 'msg_paused_1';
    (player as any).currentStatus = 'paused';
    (player as any).nativeIsPlaying = false;
    (player as any).nativeDuration = 30;
    (player as any).nativeCurrentTime = 2;

    // Seek to 50% (15s of 30s) while paused
    player.seek(50, 'msg_paused_1', 30);

    await vi.waitFor(() => {
      expect(seekAudioSpy).toHaveBeenCalledWith(15000);
    });

    expect(player.getCurrentTime()).toBe(15);
    expect(player.isPaused('msg_paused_1')).toBe(true);

    // Resume playback
    await player.resume();

    expect(resumeAudioSpy).toHaveBeenCalled();
    expect(player.isPlaying('msg_paused_1')).toBe(true);
    expect(player.getCurrentTime()).toBe(15);
  });

  it('seek before initial playback passes startPositionMs to playAudio', async () => {
    const playAudioSpy = vi.spyOn(bridge, 'playAudio').mockResolvedValue(true);

    const mockSession: any = {};
    const mockCloudClient: any = {
      getBaseUrl: () => 'https://relay.veil.local',
      getSessionToken: () => 'test_token',
    };
    const mockMeta: any = {
      objectId: 'obj_voice_seek_init',
      mimeType: 'audio/mp4',
      sizeBytes: 25600,
      durationSeconds: 100,
    };

    // Stage seek to 70% before first play
    player.seek(70, 'msg_init_seek_1', 100);

    // Initial play should pick up staged 70% -> 70,000ms
    await player.playVoiceNote(mockSession, mockCloudClient, mockMeta, 'msg_init_seek_1');

    expect(playAudioSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'msg_init_seek_1',
        startPositionMs: 70000,
      })
    );

    expect(player.getCurrentTime()).toBe(70);
    expect(player.isPlaying('msg_init_seek_1')).toBe(true);
  });

  it('resolves multiple rapid scrubs out-of-order and maintains latest revision', async () => {
    (player as any).currentPlayingId = 'msg_scrub_rapid';
    (player as any).currentStatus = 'playing';
    (player as any).nativeIsPlaying = true;
    (player as any).nativeDuration = 100;
    (player as any).nativeCurrentTime = 10;
    (player as any).lastConfirmedNativeTime = 10;

    let resolve1: (val: any) => void;
    let resolve2: (val: any) => void;
    let resolve3: (val: any) => void;

    const p1 = new Promise((res) => { resolve1 = res; });
    const p2 = new Promise((res) => { resolve2 = res; });
    const p3 = new Promise((res) => { resolve3 = res; });

    vi.spyOn(bridge, 'seekAudio').mockImplementation((posMs: number) => {
      if (posMs === 20000) return p1 as any;
      if (posMs === 45000) return p2 as any;
      if (posMs === 76000) return p3 as any;
      return Promise.resolve({ success: true, currentPositionMs: posMs, durationMs: 100000 }) as any;
    });

    // Rapidly seek 20%, 45%, 76%
    player.seek(20, 'msg_scrub_rapid', 100);
    player.seek(45, 'msg_scrub_rapid', 100);
    player.seek(76, 'msg_scrub_rapid', 100);

    // Resolve out of order: 3rd first, then 1st, then 2nd
    resolve3!({ success: true, currentPositionMs: 76000, durationMs: 100000 });
    await Promise.resolve();

    expect(player.getCurrentTime()).toBe(76);

    // Stale 1st resolves later - should be ignored due to revision check
    resolve1!({ success: true, currentPositionMs: 20000, durationMs: 100000 });
    await Promise.resolve();

    expect(player.getCurrentTime()).toBe(76);

    // Stale 2nd resolves later - should be ignored
    resolve2!({ success: true, currentPositionMs: 45000, durationMs: 100000 });
    await Promise.resolve();

    expect(player.getCurrentTime()).toBe(76);
  });

  it('failed native seek preserves previous confirmed time and does not reset to zero', async () => {
    vi.spyOn(bridge, 'seekAudio').mockResolvedValue({
      success: false,
      currentPositionMs: 0,
      durationMs: 60000,
    });

    (player as any).currentPlayingId = 'msg_fail_recovery';
    (player as any).currentStatus = 'playing';
    (player as any).nativeIsPlaying = true;
    (player as any).nativeDuration = 60;
    (player as any).nativeCurrentTime = 18; // Confirmed 18s
    (player as any).lastConfirmedNativeTime = 18;

    player.seek(80, 'msg_fail_recovery', 60);

    await vi.waitFor(() => {
      // Must revert back to confirmed 18s instead of staying at 48s or falling back to 0s
      expect(player.getCurrentTime()).toBe(18);
    });
  });
});
