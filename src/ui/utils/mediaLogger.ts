/**
 * Safe Forensic Media Logger for VEIL.
 *
 * Implements structured, privacy-preserving lifecycle telemetry for media uploads,
 * downloads, encryption, decryption, and playback.
 *
 * HARD SECURITY INVARIANTS:
 * - NEVER logs plaintext message content or media file bytes.
 * - NEVER logs encryption keys, passwords, or authentication tokens.
 * - NEVER logs raw ciphertext buffers or decrypted memory.
 * - Only records safe non-sensitive operational telemetry:
 *   attachmentId, objectId, mimeType, sizeBytes, state, duration, error messages.
 */

export interface SafeMediaEvent {
  event:
    | 'UPLOAD_QUEUED'
    | 'ENCRYPTION_STARTED'
    | 'ENCRYPTION_COMPLETED'
    | 'R2_UPLOAD_STARTED'
    | 'R2_UPLOAD_COMPLETED'
    | 'WIRE_DISPATCHED'
    | 'INBOUND_RECEIVED'
    | 'DOWNLOAD_STARTED'
    | 'DOWNLOAD_COMPLETED'
    | 'DECRYPTION_STARTED'
    | 'DECRYPTION_COMPLETED'
    | 'BLOB_CREATED'
    | 'METADATA_LOADED'
    | 'CAN_PLAY'
    | 'PLAYBACK_STARTED'
    | 'PLAYBACK_ENDED'
    | 'SEEK_EXECUTED'
    | 'MEDIA_ERROR';
  attachmentId?: string;
  objectId?: string;
  mimeType?: string;
  sizeBytes?: number;
  ciphertextSize?: number;
  duration?: number;
  seekPercent?: number;
  error?: string;
  timestamp?: number;
}

class SafeMediaLogger {
  private enabled: boolean = true;

  public log(data: SafeMediaEvent): void {
    if (!this.enabled) return;

    const payload = {
      ...data,
      timestamp: data.timestamp || Date.now(),
    };

    if (typeof console !== 'undefined' && console.log) {
      console.log(`[VEIL-MEDIA] [${payload.event}]`, {
        attachmentId: payload.attachmentId,
        objectId: payload.objectId,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        ciphertextSize: payload.ciphertextSize,
        duration: payload.duration,
        seekPercent: payload.seekPercent,
        error: payload.error,
        time: new Date(payload.timestamp).toISOString(),
      });
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

export const MediaLogger = new SafeMediaLogger();
