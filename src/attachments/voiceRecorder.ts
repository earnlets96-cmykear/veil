/**
 * Voice Message Recording & Encryption Pipeline for VEIL.
 *
 * Implements client-side microphone audio recording using MediaRecorder,
 * automatic codec negotiation, client-side XChaCha20-Poly1305 encryption,
 * S3 object storage upload, and secure ephemeral audio playback.
 *
 * HARD SECURITY INVARIANTS:
 * - Zero Raw Audio to Server: Audio is encrypted with single-use ephemeral AEAD key
 *   prior to S3 upload.
 * - Ephemeral Memory: Decrypted audio buffers are revoked when playback completes or space locks.
 */

import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { randomBytes, bytesToBase64, base64ToBytes, bytesToHex } from '../crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import type { CloudClient } from '../network/cloudClient.ts';
import type { SpaceSession } from '../spaces/session.ts';

export interface VoiceRecordingMetadata {
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
  objectId: string;
  ciphertextHash: string;
  encryptionKeyBase64: string;
  nonceBase64: string;
  spaceId?: string;
}

export type RecorderState = 'INACTIVE' | 'RECORDING' | 'PAUSED';

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime = 0;
  private timerInterval: any = null;
  private state: RecorderState = 'INACTIVE';
  private mimeType = 'audio/webm';

  public getState(): RecorderState {
    return this.state;
  }

  /**
   * Detects the preferred supported audio MIME type.
   */
  public static getSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/aac',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return 'audio/webm';
  }

  /**
   * Starts microphone recording.
   */
  public async startRecording(onTimerUpdate?: (elapsedSeconds: number) => void): Promise<void> {
    if (this.state !== 'INACTIVE') {
      throw new Error('Recording already active');
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone recording is not supported in this environment');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = VoiceRecorder.getSupportedMimeType();
    this.audioChunks = [];

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.mimeType,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100);
    this.state = 'RECORDING';
    this.startTime = Date.now();

    if (onTimerUpdate) {
      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        onTimerUpdate(elapsed);
      }, 500);
    }
  }

  /**
   * Stops recording and returns the raw recorded audio Blob and duration.
   */
  public async stopRecording(): Promise<{ audioBlob: Blob; durationSeconds: number; mimeType: string }> {
    if (!this.mediaRecorder || this.state === 'INACTIVE') {
      throw new Error('No recording in progress');
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const durationSeconds = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const finalBlob = new Blob(this.audioChunks, { type: this.mimeType });
        this.cleanupStream();
        this.state = 'INACTIVE';
        resolve({
          audioBlob: finalBlob,
          durationSeconds,
          mimeType: this.mimeType,
        });
      };
      this.mediaRecorder!.stop();
    });
  }

  /**
   * Cancels and discards active recording.
   */
  public cancelRecording(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.state !== 'INACTIVE') {
      try {
        this.mediaRecorder.stop();
      } catch (_e) {}
    }
    this.cleanupStream();
    this.audioChunks = [];
    this.state = 'INACTIVE';
  }

  private cleanupStream(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }

  /**
   * Encrypts voice audio bytes with single-use ephemeral AEAD key
   * and uploads the ciphertext to S3 object storage.
   */
  public static async encryptAndUploadVoiceNote(
    session: SpaceSession,
    cloudClient: CloudClient,
    rawAudioBytes: Uint8Array,
    durationSeconds: number,
    mimeType: string,
    recipientAuth?: { recipientAccountId?: string; recipientUsername?: string; recipientIdentityId?: string; allowedAccounts?: string[] }
  ): Promise<VoiceRecordingMetadata> {
    const attachmentId = `voice_${Date.now()}_${bytesToHex(randomBytes(6))}`;
    const ephemeralKey = randomBytes(32);

    const aad = new TextEncoder().encode(`VEIL-VOICE-v1|spaceId:${session.spaceId}`);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(
      ephemeralKey,
      rawAudioBytes,
      aad
    );

    const ciphertextHash = bytesToHex(sha256(ciphertext));

    // 1. Create attachment record in cloud DB with recipient authorization metadata
    const metadataPayload: any = { durationSeconds, mimeType, spaceId: session.spaceId };
    if (recipientAuth?.recipientAccountId) metadataPayload.recipientAccountId = recipientAuth.recipientAccountId;
    if (recipientAuth?.recipientUsername) metadataPayload.recipientUsername = recipientAuth.recipientUsername;
    if (recipientAuth?.recipientIdentityId) metadataPayload.recipientIdentityId = recipientAuth.recipientIdentityId;
    if (recipientAuth?.allowedAccounts) metadataPayload.allowedAccounts = recipientAuth.allowedAccounts;

    const { attachment } = await cloudClient.createAttachment({
      attachmentId,
      spaceId: session.spaceId,
      ciphertextSize: ciphertext.length,
      ciphertextHash,
      recipientAccountId: recipientAuth?.recipientAccountId,
      recipientUsername: recipientAuth?.recipientUsername,
      allowedAccounts: recipientAuth?.allowedAccounts,
      encryptedMetadata: JSON.stringify(metadataPayload),
    });

    // 2. Upload encrypted audio ciphertext to S3 object storage
    await cloudClient.uploadAttachment(attachment.objectId, ciphertext);

    return {
      durationSeconds,
      mimeType,
      sizeBytes: rawAudioBytes.length,
      objectId: attachment.objectId,
      ciphertextHash,
      encryptionKeyBase64: bytesToBase64(ephemeralKey),
      nonceBase64: bytesToBase64(nonce),
      spaceId: session.spaceId,
    };
  }

  /**
   * Downloads encrypted audio blob from S3 and decrypts locally into playable object URL.
   */
  public static async downloadAndDecryptVoiceNote(
    session: SpaceSession,
    cloudClient: CloudClient,
    meta: VoiceRecordingMetadata
  ): Promise<string> {
    const ciphertext = await cloudClient.downloadAttachment(meta.objectId);
    const key = base64ToBytes(meta.encryptionKeyBase64);
    const nonce = base64ToBytes(meta.nonceBase64);

    let plaintextBytes: Uint8Array;
    const targetSpaceId = (meta as any).spaceId || session.spaceId;
    try {
      const aad = new TextEncoder().encode(`VEIL-VOICE-v1|spaceId:${targetSpaceId}`);
      plaintextBytes = decryptXChaCha20Poly1305(key, nonce, ciphertext, aad);
    } catch (_e) {
      try {
        const localAad = new TextEncoder().encode(`VEIL-VOICE-v1|spaceId:${session.spaceId}`);
        plaintextBytes = decryptXChaCha20Poly1305(key, nonce, ciphertext, localAad);
      } catch (_e2) {
        try {
          const canonicalAad = new TextEncoder().encode('VEIL-VOICE-v1');
          plaintextBytes = decryptXChaCha20Poly1305(key, nonce, ciphertext, canonicalAad);
        } catch (_e3) {
          plaintextBytes = decryptXChaCha20Poly1305(key, nonce, ciphertext);
        }
      }
    }

    const blob = new Blob([plaintextBytes as any], { type: meta.mimeType || 'audio/webm' });
    return URL.createObjectURL(blob);
  }

  /**
   * Plays a decrypted voice note via singleton VoicePlayer.
   */
  public static async playVoiceNote(
    session: SpaceSession,
    cloudClient: CloudClient,
    meta: VoiceRecordingMetadata,
    messageId: string,
    callbacks?: any
  ): Promise<void> {
    const { VoicePlayer } = await import('./voicePlayer.ts');
    return VoicePlayer.playVoiceNote(session, cloudClient, meta, messageId, callbacks);
  }

  /**
   * Stops active voice note playback.
   */
  public static async stopPlayback(): Promise<void> {
    const { VoicePlayer } = await import('./voicePlayer.ts');
    VoicePlayer.stop();
  }
}

export * from './voicePlayer.ts';
