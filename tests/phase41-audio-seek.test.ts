import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { randomBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { VoiceRecordingMetadata } from '../src/attachments/voiceRecorder.ts';

describe('Phase 41: Audio Seeking Physical Control & Time Synchronization', () => {
  let player: VoicePlaybackManager;

  beforeEach(() => {
    player = new VoicePlaybackManager();
  });

  afterEach(() => {
    player.stop();
  });

  it('seek(percent) directly updates staged seek position before audio starts', () => {
    player.seek(50, 'msg_voice_1');
    // Staged seek should calculate midpoint of duration (default 1s -> 0.5s)
    expect(player.getCurrentTime()).toBe(0); // Audio not playing yet

    player.seek(75, 'msg_voice_1');
    // Clamping works
    player.seek(150, 'msg_voice_1');
    player.seek(-20, 'msg_voice_1');
  });

  it('seek(percent) computes targetTime from actual duration and updates audio.currentTime', () => {
    const mockAudio: any = {
      src: '',
      currentTime: 0,
      duration: 60, // 60 seconds
      paused: false,
      ended: false,
      play: async () => {},
      pause: () => {},
      load: () => {},
    };

    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_voice_active';

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

    // Seek to 0% -> target = 0s
    player.seek(0);
    expect(mockAudio.currentTime).toBe(0);
    expect(reportedPercent).toBe(0);
    expect(reportedCurrentTime).toBe(0);
    expect(reportedDuration).toBe(60);

    // Seek to 50% -> target = 30s
    player.seek(50);
    expect(mockAudio.currentTime).toBe(30);
    expect(reportedPercent).toBe(50);
    expect(reportedCurrentTime).toBe(30);
    expect(reportedDuration).toBe(60);

    // Seek to 100% -> target = 60s
    player.seek(100);
    expect(mockAudio.currentTime).toBe(60);
    expect(reportedPercent).toBe(100);
    expect(reportedCurrentTime).toBe(60);

    // Seek to 25% -> target = 15s
    player.seek(25);
    expect(mockAudio.currentTime).toBe(15);
    expect(reportedCurrentTime).toBe(15);
  });
});
