import { describe, it, expect, beforeEach } from 'vitest';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';

describe('Phase 42: Video Player Lifecycle, Seek & Diagnostic Telemetry Suite', () => {
  beforeEach(() => {
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();
  });

  it('records video metadata, canplay, playing, seeking, and ended telemetry accurately', () => {
    // Simulate Video Player lifecycle events
    const objectId = 'obj_vid_test_01';
    RuntimeDiagnostics.video('metadataLoaded', { duration: 45.2, objectId });
    RuntimeDiagnostics.video('canPlay', { objectId });
    RuntimeDiagnostics.video('playing', { objectId });
    RuntimeDiagnostics.video('seekExecuted', {
      targetPercent: 50,
      targetSeconds: 22.6,
      actualCurrentTime: 22.6,
      duration: 45.2,
    });
    RuntimeDiagnostics.video('ended', { objectId });

    const videoEvents = RuntimeDiagnostics.getHistory('VIDEO');
    expect(videoEvents.length).toBe(5);

    expect(videoEvents[0].tag).toBe('metadataLoaded');
    expect(videoEvents[0].data.duration).toBe(45.2);

    expect(videoEvents[1].tag).toBe('canPlay');
    expect(videoEvents[2].tag).toBe('playing');

    expect(videoEvents[3].tag).toBe('seekExecuted');
    expect(videoEvents[3].data.targetSeconds).toBe(22.6);
    expect(videoEvents[3].data.actualCurrentTime).toBe(22.6);

    expect(videoEvents[4].tag).toBe('ended');
  });

  it('records video error state and cleans up without throwing uncaught errors', () => {
    const objectId = 'obj_broken_vid';
    RuntimeDiagnostics.video('error', { objectId, error: 'Video playback failed' });

    const errorEvents = RuntimeDiagnostics.getHistory('VIDEO').filter((e) => e.tag === 'error');
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].data.error).toBe('Video playback failed');
  });
});
