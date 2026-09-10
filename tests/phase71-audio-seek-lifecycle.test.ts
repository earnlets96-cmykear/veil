import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';

class DeferredSeekAudio {
  static latest: DeferredSeekAudio | null = null;
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  ended = false;
  readyState = 0;
  src = '';
  onloadedmetadata: (() => void) | null = null;
  oncanplay: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<() => void>>();
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();

  constructor() {
    DeferredSeekAudio.latest = this;
  }

  addEventListener(event: string, listener: () => void) {
    const listeners = this.listeners.get(event) || new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }

  removeEventListener(event: string, listener: () => void) {
    this.listeners.get(event)?.delete(listener);
  }

  emitCanPlay(duration = 80) {
    this.duration = duration;
    this.readyState = 3;
    this.oncanplay?.();
    this.listeners.get('canplay')?.forEach((listener) => listener());
  }

  emitSeeked() {
    this.listeners.get('seeked')?.forEach((listener) => listener());
  }
}

describe('Phase 71: staged voice seek lifecycle', () => {
  const originalAudio = (globalThis as any).Audio;

  afterEach(() => {
    (globalThis as any).Audio = originalAudio;
    vi.restoreAllMocks();
  });

  it('waits for seek completion before starting staged web playback', async () => {
    (globalThis as any).Audio = DeferredSeekAudio;
    vi.spyOn(VoiceRecorder, 'downloadAndDecryptVoiceNote').mockResolvedValue('blob:voice' as any);
    const player = new VoicePlaybackManager();
    player.seek(50, 'voice-1', 80);

    const playPromise = player.playVoiceNote({} as any, {} as any, {
      objectId: 'object-1', durationSeconds: 80, sizeBytes: 10, mimeType: 'audio/webm',
      ciphertextHash: 'hash', encryptionKeyBase64: 'key', nonceBase64: 'nonce',
    }, 'voice-1');

    await Promise.resolve();
    const audio = DeferredSeekAudio.latest!;
    audio.emitCanPlay();
    await Promise.resolve();

    expect(audio.currentTime).toBe(40);
    expect(audio.play).not.toHaveBeenCalled();

    audio.emitSeeked();
    await playPromise;
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(40);
  });
});
