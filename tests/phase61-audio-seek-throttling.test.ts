import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';

describe('VEIL Phase 61: Audio Seek Throttling & Playback Resilience Tests', () => {
  let player: VoicePlaybackManager;

  beforeEach(() => {
    player = new VoicePlaybackManager();
  });

  it('safely stages seek when readyState is 0 (HAVE_NOTHING) without throwing DOMException', () => {
    let mockCurrentTime = 0;
    const mockAudio: any = {
      readyState: 0, // HAVE_NOTHING
      duration: 10,
      get currentTime() {
        return mockCurrentTime;
      },
      set currentTime(val: number) {
        // In real browsers, setting currentTime when readyState is 0 can throw an InvalidStateError
        throw new Error('InvalidStateError: The element has not yet loaded metadata.');
      },
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    };

    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_audio_01';
    (player as any).currentDuration = 10;
    (player as any).currentStatus = 'playing';

    const listener = vi.fn();
    player.subscribe('msg_audio_01', listener);

    // Seeking to 50% must not throw despite readyState === 0
    expect(() => {
      player.seek(50, 'msg_audio_01');
    }).not.toThrow();

    // Listener was called with 50% (5.0s)
    expect(listener).toHaveBeenCalledWith('playing', 50, 5, 10);
  });

  it('handles rapid sequential scrubbing calls (0% -> 99%) without state corruption', () => {
    let mockCurrentTime = 0;
    const mockAudio: any = {
      readyState: 4, // HAVE_ENOUGH_DATA
      duration: 20,
      get currentTime() {
        return mockCurrentTime;
      },
      set currentTime(val: number) {
        mockCurrentTime = val;
      },
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    };

    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_audio_rapid';
    (player as any).currentDuration = 20;
    (player as any).currentStatus = 'playing';

    const listenerUpdates: number[] = [];
    player.subscribe('msg_audio_rapid', (status, percent) => {
      listenerUpdates.push(percent);
    });

    // Simulate rapid scrubbing events
    const seekPercents = [10, 25, 40, 55, 70, 85, 95, 30, 60, 100];
    for (const pct of seekPercents) {
      player.seek(pct, 'msg_audio_rapid');
    }

    expect(mockCurrentTime).toBe(20); // 100% of 20s
    // Initial notification is 0%, followed by each seek percentage
    expect(listenerUpdates).toEqual([0, ...seekPercents]);
  });

  it('clamps out-of-bound seek percentages safely (negative and > 100)', () => {
    let mockCurrentTime = 5;
    const mockAudio: any = {
      readyState: 4,
      duration: 10,
      get currentTime() {
        return mockCurrentTime;
      },
      set currentTime(val: number) {
        mockCurrentTime = val;
      },
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    };

    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_bounds';
    (player as any).currentDuration = 10;
    (player as any).currentStatus = 'playing';

    // Negative percent
    player.seek(-15, 'msg_bounds');
    expect(mockCurrentTime).toBe(0);

    // Percent > 100
    player.seek(150, 'msg_bounds');
    expect(mockCurrentTime).toBe(10);
  });
});
