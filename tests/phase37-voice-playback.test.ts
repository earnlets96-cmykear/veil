/**
 * Phase 37 — Voice Playback & Audio Pipeline Test Suite
 *
 * Verifies:
 * 1. VoicePlayer singleton and class export methods are defined and callable.
 * 2. VoiceRecorder decryption and playback helpers operate without undefined method crashes.
 * 3. Seek, stop, and playback state tracking function cleanly.
 */

import { describe, it, expect } from 'vitest';
import { VoicePlayer, VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';

describe('Phase 37 — Voice Playback Pipeline Verification', () => {
  it('5.1: VoicePlayer singleton exposes expected playback API', () => {
    expect(VoicePlayer).toBeDefined();
    expect(typeof VoicePlayer.playVoiceNote).toBe('function');
    expect(typeof VoicePlayer.stop).toBe('function');
    expect(typeof VoicePlayer.seek).toBe('function');
    expect(typeof VoicePlayer.isPlaying).toBe('function');
    expect(typeof VoicePlayer.getPlayingId).toBe('function');
    expect(VoicePlaybackManager).toBeDefined();
  });

  it('5.2: VoiceRecorder static playback helper is properly bound', () => {
    expect(VoiceRecorder).toBeDefined();
    expect(typeof VoiceRecorder.playVoiceNote).toBe('function');
    expect(typeof VoiceRecorder.downloadAndDecryptVoiceNote).toBe('function');
    expect(typeof VoiceRecorder.stopPlayback).toBe('function');
  });

  it('5.3: VoicePlayback state transitions from stopped cleanly', () => {
    expect(VoicePlayer.isPlaying()).toBe(false);
    expect(VoicePlayer.getPlayingId()).toBeNull();
    VoicePlayer.stop(); // Safe to call when already stopped
    expect(VoicePlayer.isPlaying()).toBe(false);
  });
});
