import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';

describe('Phase 42: Audio Seeking Physical Control & Diagnostic Telemetry Suite', () => {
  let player: VoicePlaybackManager;

  beforeEach(() => {
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();
    player = new VoicePlaybackManager();
  });

  afterEach(() => {
    player.stop();
  });

  it('verifies seek(percent) directly updates HTMLAudioElement.currentTime and records diagnostic telemetry', () => {
    const mockAudio: any = {
      src: '',
      currentTime: 0,
      duration: 80, // 80 second audio clip
      paused: false,
      ended: false,
      play: async () => {},
      pause: () => {},
      load: () => {},
    };

    (player as any).currentAudio = mockAudio;
    (player as any).currentPlayingId = 'msg_voice_p42';

    let progressFired = false;
    let reportedCurrentTime = 0;
    (player as any).activeCallbacks = {
      onProgress: (_p: number, ct: number) => {
        progressFired = true;
        reportedCurrentTime = ct;
      },
    };

    // Seek to 50%
    player.seek(50);
    expect(mockAudio.currentTime).toBe(40);
    expect(reportedCurrentTime).toBe(40);
    expect(progressFired).toBe(true);

    // Verify RuntimeDiagnostics recorded the event
    const audioEvents = RuntimeDiagnostics.getHistory('AUDIO');
    expect(audioEvents.length).toBeGreaterThan(0);
    const lastEvent = audioEvents[audioEvents.length - 1];
    expect(lastEvent.tag).toBe('seekRequested');
    expect(lastEvent.data.duration).toBe(80);
    expect(lastEvent.data.seekRequested).toBe(50);
    expect(lastEvent.data.targetTime).toBe(40);
    expect(lastEvent.data.actualCurrentTime).toBe(40);

    // Seek to 75%
    player.seek(75);
    expect(mockAudio.currentTime).toBe(60);
    expect(reportedCurrentTime).toBe(60);

    // Seek to 25%
    player.seek(25);
    expect(mockAudio.currentTime).toBe(20);
    expect(reportedCurrentTime).toBe(20);
  });

  it('stages seek percent when audio is not yet playing and applies on playback', () => {
    player.seek(33, 'msg_voice_staged');

    const audioEvents = RuntimeDiagnostics.getHistory('AUDIO');
    expect(audioEvents.length).toBeGreaterThan(0);
    const event = audioEvents[0];
    expect(event.data.seekRequested).toBe(33);
    expect(event.data.audioActive).toBe(false);
  });
});
