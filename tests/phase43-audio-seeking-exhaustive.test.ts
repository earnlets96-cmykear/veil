import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';

describe('Phase 43: Exhaustive Audio Seeking & Boundary Suite', () => {
  let player: VoicePlaybackManager;

  beforeEach(() => {
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();
    player = new VoicePlaybackManager();
  });

  afterEach(() => {
    player.stop();
  });

  it('calculates exact currentTime for seek(0), seek(25), seek(50), seek(75), seek(100)', () => {
    const mockAudio: any = {
      src: '',
      currentTime: 0,
      duration: 120, // 120 second voice note
      paused: false,
      ended: false,
      play: async () => {},
      pause: () => {},
      load: () => {},
    };

    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_audio_seek_matrix';

    let reportedTime = 0;
    (player as any).activeCallbacks = {
      onProgress: (_p: number, ct: number) => {
        reportedTime = ct;
      },
    };

    // seek(0) -> 0.0s
    player.seek(0);
    expect(mockAudio.currentTime).toBe(0);
    expect(reportedTime).toBe(0);

    // seek(25) -> 30.0s
    player.seek(25);
    expect(mockAudio.currentTime).toBe(30);
    expect(reportedTime).toBe(30);

    // seek(50) -> 60.0s
    player.seek(50);
    expect(mockAudio.currentTime).toBe(60);
    expect(reportedTime).toBe(60);

    // seek(75) -> 90.0s
    player.seek(75);
    expect(mockAudio.currentTime).toBe(90);
    expect(reportedTime).toBe(90);

    // seek(100) -> 120.0s
    player.seek(100);
    expect(mockAudio.currentTime).toBe(120);
    expect(reportedTime).toBe(120);
  });

  it('safely clamps out-of-bounds seeks below 0% and above 100%', () => {
    const mockAudio: any = {
      src: '',
      currentTime: 0,
      duration: 50,
      paused: true,
      play: async () => {},
      pause: () => {},
      load: () => {},
    };

    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_audio_bounds';

    // seek(-20) -> Clamped to 0s
    player.seek(-20);
    expect(mockAudio.currentTime).toBe(0);

    // seek(150) -> Clamped to 50s
    player.seek(150);
    expect(mockAudio.currentTime).toBe(50);
  });

  it('handles edge cases: duration=0, duration=NaN, unloaded audio gracefully without throwing', () => {
    // 1. Unloaded audio (currentAudio = null)
    expect(() => player.seek(50, 'msg_unloaded')).not.toThrow();

    // 2. duration = 0
    const mockZeroAudio: any = {
      src: '',
      currentTime: 0,
      duration: 0,
      paused: true,
      play: async () => {},
      pause: () => {},
      load: () => {},
    };
    (player as any).currentAudio = mockZeroAudio;
    expect(() => player.seek(50)).not.toThrow();

    // 3. duration = NaN
    const mockNanAudio: any = {
      src: '',
      currentTime: 0,
      duration: NaN,
      paused: true,
      play: async () => {},
      pause: () => {},
      load: () => {},
    };
    (player as any).currentAudio = mockNanAudio;
    expect(() => player.seek(50)).not.toThrow();
  });

  it('supports rapid repeated seeks while playing and while paused', () => {
    const mockAudio: any = {
      src: '',
      currentTime: 10,
      duration: 100,
      paused: false,
      play: async () => {},
      pause: () => {},
      load: () => {},
    };
    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_rapid_seek';

    // Rapid seeking while playing
    player.seek(10);
    player.seek(20);
    player.seek(30);
    player.seek(40);
    expect(mockAudio.currentTime).toBe(40);

    // Pause audio and seek
    mockAudio.paused = true;
    player.seek(80);
    player.seek(60);
    expect(mockAudio.currentTime).toBe(60);
  });
});
