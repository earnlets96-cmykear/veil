import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoicePlaybackManager, VoicePlayer } from '../src/attachments/voicePlayer.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { encryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { randomBytes, bytesToBase64, bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

describe('Phase 37 — Voice Message Playback & Player Architecture', () => {
  let player: VoicePlaybackManager;
  let mockSession: any;
  let mockCloudClient: any;
  let sampleVoiceMeta: any;
  let ephemeralKey: Uint8Array;
  let nonce: Uint8Array;
  let ciphertext: Uint8Array;

  beforeEach(() => {
    player = new VoicePlaybackManager();
    ephemeralKey = randomBytes(32);
    const rawAudio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const aad = new TextEncoder().encode('VEIL-VOICE-v1|spaceId:space_test_123');
    const encrypted = encryptXChaCha20Poly1305(ephemeralKey, rawAudio, aad);
    nonce = encrypted.nonce;
    ciphertext = encrypted.ciphertext;

    sampleVoiceMeta = {
      durationSeconds: 4,
      mimeType: 'audio/webm',
      sizeBytes: rawAudio.length,
      objectId: 'obj_voice_test_001',
      ciphertextHash: bytesToHex(sha256(ciphertext)),
      encryptionKeyBase64: bytesToBase64(ephemeralKey),
      nonceBase64: bytesToBase64(nonce),
      spaceId: 'space_test_123',
    };

    mockSession = {
      spaceId: 'space_test_123',
    };

    mockCloudClient = {
      downloadAttachment: vi.fn().mockResolvedValue(ciphertext),
    };
  });

  afterEach(() => {
    player.stop();
    VoicePlayer.stop();
  });

  it('should initialize with idle state and no active playing id', () => {
    expect(player.getPlayingId()).toBeNull();
    expect(player.isPlaying()).toBe(false);
  });

  it('should successfully download ciphertext, AEAD decrypt, and start playback', async () => {
    let endedCalled = false;
    let progressPercent = -1;

    await player.playVoiceNote(
      mockSession,
      mockCloudClient,
      sampleVoiceMeta,
      'msg_voice_001',
      {
        onProgress: (p) => {
          progressPercent = p;
        },
        onEnded: () => {
          endedCalled = true;
        },
      }
    );

    expect(mockCloudClient.downloadAttachment).toHaveBeenCalledWith('obj_voice_test_001');
    expect(player.getPlayingId()).toBe('msg_voice_001');
    expect(player.isPlaying('msg_voice_001')).toBe(true);
  });

  it('should handle pause, seek, and stop without leaking memory or throwing', async () => {
    await player.playVoiceNote(
      mockSession,
      mockCloudClient,
      sampleVoiceMeta,
      'msg_voice_002'
    );

    player.pause();
    expect(player.isPlaying('msg_voice_002')).toBe(false);

    player.seek(50);
    player.stop();

    expect(player.getPlayingId()).toBeNull();
    expect(player.isPlaying()).toBe(false);
  });

  it('should allow static convenience calls on VoiceRecorder without throwing ml.playvoicenote', async () => {
    expect(typeof VoiceRecorder.playVoiceNote).toBe('function');
    expect(typeof VoiceRecorder.stopPlayback).toBe('function');

    await VoiceRecorder.playVoiceNote(
      mockSession,
      mockCloudClient,
      sampleVoiceMeta,
      'msg_voice_003'
    );

    expect(VoicePlayer.getPlayingId()).toBe('msg_voice_003');
    await VoiceRecorder.stopPlayback();
    expect(VoicePlayer.getPlayingId()).toBeNull();
  });
});
