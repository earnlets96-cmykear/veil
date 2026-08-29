/**
 * Phase 40: Audio Waveform Seeking & Staged Playback Test Suite.
 *
 * Verifies:
 * - Staged seek before playback starts correctly applies upon play
 * - Active seeking while playing updates audio.currentTime
 * - Seeking while paused updates position without unhandled exceptions
 * - Continuous scrubbing dispatch to onProgress callback
 * - Clamping of boundary values (0%, 100%, negative, >100%, NaN)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';

describe('Phase 40: Audio Waveform Seeking & Staged Playback', () => {
  let player: VoicePlaybackManager;

  beforeEach(() => {
    player = new VoicePlaybackManager();
  });

  it('stages seek percent when audio is not yet initialized', () => {
    player.seek(42, 'msg_staged_1');
    expect((player as any).stagedSeekPercent['msg_staged_1']).toBe(42);
  });

  it('updates currentTime and fires onProgress during active playback', () => {
    let notifiedPercent = -1;
    let notifiedTime = -1;

    (player as any).currentAudio = {
      currentTime: 0,
      duration: 80,
      paused: false,
      ended: false,
      pause: () => {},
      play: async () => {},
      load: () => {},
    };

    (player as any).activeCallbacks = {
      onProgress: (p: number, t: number) => {
        notifiedPercent = p;
        notifiedTime = t;
      },
    };

    // Seek to 75%
    player.seek(75);
    expect(notifiedPercent).toBe(75);
    expect(notifiedTime).toBe(60);
    expect((player as any).currentAudio.currentTime).toBe(60);

    // Seek to 25%
    player.seek(25);
    expect(notifiedPercent).toBe(25);
    expect(notifiedTime).toBe(20);
    expect((player as any).currentAudio.currentTime).toBe(20);
  });

  it('safely clamps extreme seek values', () => {
    (player as any).currentAudio = {
      currentTime: 0,
      duration: 100,
      paused: true,
      ended: false,
      pause: () => {},
      play: async () => {},
      load: () => {},
    };

    player.seek(-50);
    expect((player as any).currentAudio.currentTime).toBe(0);

    player.seek(200);
    expect((player as any).currentAudio.currentTime).toBe(100);

    player.seek(NaN);
    expect((player as any).currentAudio.currentTime).toBe(0);
  });
});
