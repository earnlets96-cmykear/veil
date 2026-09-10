/**
 * Voice Message Playback Manager for VEIL.
 *
 * Implements authenticated cloud retrieval via durable MediaCache,
 * ephemeral in-memory audio buffer playback via stable HTMLAudioElement,
 * instantaneous pause/resume, accurate byte-range seeking, zero-lag localized UI subscriptions,
 * and comprehensive diagnostic telemetry.
 */

import { CloudClient } from '../network/cloudClient.ts';
import { SpaceSession } from '../spaces/session.ts';
import { VoiceRecordingMetadata, VoiceRecorder } from './voiceRecorder.ts';
import { MediaLogger } from '../ui/utils/mediaLogger.ts';
import { RuntimeDiagnostics } from '../debug/runtimeDiagnostics.ts';
import { NativeMediaBridge } from '../media/NativeMediaBridge.ts';

export type VoicePlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface VoicePlaybackCallbacks {
  onProgress?: (progressPercent: number, currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export type VoicePlaybackListener = (
  status: VoicePlaybackStatus,
  progressPercent: number,
  currentTime: number,
  duration: number
) => void;

export class VoicePlaybackManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private currentPlayingId: string | null = null;
  private currentStatus: VoicePlaybackStatus = 'idle';
  private activeCallbacks: VoicePlaybackCallbacks | null = null;
  private currentDuration: number = 0;
  private knownDurations: Record<string, number> = {};
  private stagedSeekPercent: Record<string, number> = {};
  private listeners: Map<string, Set<VoicePlaybackListener>> = new Map();
  private isNative: boolean = false;
  private nativeCurrentTime: number = 0;
  private nativeDuration: number = 0;
  private nativeIsPlaying: boolean = false;
  private pendingNativeSeekRevision: number = 0;
  private lastConfirmedNativeTime: number = 0;

  constructor() {
    this.isNative = NativeMediaBridge.getInstance().isSupported();
    if (this.isNative) {
      const bridge = NativeMediaBridge.getInstance();
      bridge.onStateChange((e) => {
        this.nativeIsPlaying = e.isPlaying;
        this.nativeCurrentTime = (e.currentPositionMs || 0) / 1000;
        this.lastConfirmedNativeTime = this.nativeCurrentTime;
        if (e.durationMs > 0) this.nativeDuration = e.durationMs / 1000;
        const status: VoicePlaybackStatus =
          e.state === 'playing' ? 'playing' : e.state === 'paused' ? 'paused' : e.state === 'buffering' ? 'loading' : e.state === 'error' ? 'error' : 'idle';
        const dur = this.getDuration();
        const cur = this.getCurrentTime();
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        this.notifyListeners(status, pct, cur, dur);
      });

      bridge.onProgress((e) => {
        this.nativeCurrentTime = (e.currentPositionMs || 0) / 1000;
        this.lastConfirmedNativeTime = this.nativeCurrentTime;
        if (e.durationMs > 0) this.nativeDuration = e.durationMs / 1000;
        const dur = this.getDuration();
        const cur = this.getCurrentTime();
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        this.notifyListeners(this.currentStatus, pct, cur, dur);
        if (this.activeCallbacks?.onProgress) {
          this.activeCallbacks.onProgress(pct, cur, dur);
        }
      });

      bridge.onEnded((e) => {
        this.nativeIsPlaying = false;
        this.nativeCurrentTime = 0;
        const dur = this.getDuration();
        this.notifyListeners('idle', 0, 0, dur);
        this.stop();
        if (this.activeCallbacks?.onEnded) this.activeCallbacks.onEnded();
      });

      bridge.onError((e) => {
        this.nativeIsPlaying = false;
        this.currentStatus = 'error';
        this.notifyListeners('error', 0, 0, this.getDuration());
        if (this.activeCallbacks?.onError) {
          this.activeCallbacks.onError(new Error(e.message || 'Playback error'));
        }
      });
    }
  }

  public getPlayingId(): string | null {
    return this.currentPlayingId;
  }

  public getStatus(id?: string): VoicePlaybackStatus {
    if (!id || id === this.currentPlayingId) {
      return this.currentStatus;
    }
    return 'idle';
  }

  public isPlaying(id?: string): boolean {
    if (this.isNative) {
      if (id) {
        return this.currentPlayingId === id && this.nativeIsPlaying;
      }
      return this.nativeIsPlaying;
    }
    if (!this.currentAudio) return false;
    if (id) {
      return this.currentPlayingId === id && !this.currentAudio.paused && !this.currentAudio.ended;
    }
    return !this.currentAudio.paused && !this.currentAudio.ended;
  }

  public isPaused(id?: string): boolean {
    if (this.isNative) {
      if (!this.currentPlayingId) return false;
      if (id && this.currentPlayingId !== id) return false;
      return !this.nativeIsPlaying && this.currentStatus === 'paused';
    }
    if (!this.currentAudio || !this.currentPlayingId) return false;
    if (id && this.currentPlayingId !== id) return false;
    return this.currentAudio.paused && !this.currentAudio.ended && this.currentStatus === 'paused';
  }

  public getCurrentTime(): number {
    if (this.isNative) {
      return this.nativeCurrentTime;
    }
    return this.currentAudio ? this.currentAudio.currentTime || 0 : 0;
  }

  public getDuration(fallback?: number): number {
    if (this.isNative) {
      if (this.nativeDuration > 0) return this.nativeDuration;
      if (this.currentDuration > 0) return this.currentDuration;
      return fallback || 0;
    }
    if (
      this.currentAudio &&
      this.currentAudio.duration &&
      !isNaN(this.currentAudio.duration) &&
      isFinite(this.currentAudio.duration)
    ) {
      return this.currentAudio.duration;
    }
    if (this.currentDuration && isFinite(this.currentDuration) && this.currentDuration > 0) {
      return this.currentDuration;
    }
    return fallback || 0;
  }

  /**
   * Subscribe to playback events for a specific message ID.
   * Enables localized UI updates in VoiceNoteCard without full ConversationView re-renders.
   */
  public subscribe(messageId: string, listener: VoicePlaybackListener): () => void {
    if (!this.listeners.has(messageId)) {
      this.listeners.set(messageId, new Set());
    }
    this.listeners.get(messageId)!.add(listener);

    // Immediately notify listener of current state
    const isCurrent = this.currentPlayingId === messageId;
    const status = isCurrent ? this.currentStatus : 'idle';
    const staged = this.stagedSeekPercent[messageId];
    const duration = isCurrent ? this.getDuration() : (this.knownDurations[messageId] || this.currentDuration || 0);
    let currentTime = isCurrent ? this.getCurrentTime() : 0;
    let progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    if (typeof staged === 'number') {
      progress = staged;
      if (duration > 0) currentTime = (staged / 100) * duration;
    }
    listener(status, progress, currentTime, duration);

    return () => {
      const set = this.listeners.get(messageId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(messageId);
        }
      }
    };
  }

  private notifyListeners(
    status: VoicePlaybackStatus,
    progressPercent: number,
    currentTime: number,
    duration: number,
    targetId?: string
  ): void {
    const id = targetId || this.currentPlayingId;
    if (id === this.currentPlayingId) {
      this.currentStatus = status;
    }
    if (!id) return;
    const set = this.listeners.get(id);
    if (set) {
      for (const listener of set) {
        try {
          listener(status, progressPercent, currentTime, duration);
        } catch (_e) {}
      }
    }
  }

  /**
   * Downloads or loads cached audio bytes, attaches to stable audio element, and starts playback.
   *
   * Key design decisions:
   * - Reuses existing audio element + blob URL when the same message is re-played.
   * - Waits for `canplay` before calling `play()` to prevent AbortError on slow media loads.
   * - Applies staged seek in `canplay` handler where readyState >= 3 guarantees currentTime assignment.
   * - Gracefully handles play() rejections (NotAllowedError/AbortError) without destroying the audio.
   */
  public async playVoiceNote(
    session: SpaceSession,
    cloudClient: CloudClient,
    meta: VoiceRecordingMetadata,
    messageId: string,
    callbacks: VoicePlaybackCallbacks = {}
  ): Promise<void> {
    this.activeCallbacks = callbacks;
    const safeDuration = meta.durationSeconds && isFinite(meta.durationSeconds) ? meta.durationSeconds : 0;
    this.currentDuration = safeDuration;
    if (safeDuration > 0 && messageId) {
      this.knownDurations[messageId] = safeDuration;
    }

    // 1. If this exact message is already loaded and paused, resume immediately!
    if (this.currentPlayingId === messageId && this.currentStatus === 'paused') {
      if (this.isNative) {
        await NativeMediaBridge.getInstance().resumeAudio();
        return;
      }
      if (this.currentAudio && this.currentAudio.paused) {
        try {
          // Apply any staged seek before resuming
          const staged = this.stagedSeekPercent[messageId];
          if (typeof staged === 'number' && staged > 0) {
            const dur = this.getDuration(safeDuration);
            if (dur > 0) {
              try { this.currentAudio.currentTime = (staged / 100) * dur; } catch (_e) {}
            }
            delete this.stagedSeekPercent[messageId];
          }
          await this.currentAudio.play();
          this.currentStatus = 'playing';
          const dur = this.getDuration(safeDuration);
          const cur = this.getCurrentTime();
          const pct = dur > 0 ? (cur / dur) * 100 : 0;
          this.notifyListeners('playing', pct, cur, dur);
          if (this.activeCallbacks?.onProgress) {
            this.activeCallbacks.onProgress(pct, cur, dur);
          }
          MediaLogger.log({
            event: 'PLAYBACK_STARTED',
            objectId: meta.objectId,
            duration: dur,
          });
          return;
        } catch (resumeErr: any) {
          // If resume fails with AbortError / NotAllowedError, don't destroy — stay paused
          const errName = resumeErr?.name || '';
          if (errName === 'AbortError' || errName === 'NotAllowedError') {
            this.currentStatus = 'paused';
            const dur = this.getDuration(safeDuration);
            const cur = this.getCurrentTime();
            const pct = dur > 0 ? (cur / dur) * 100 : 0;
            this.notifyListeners('paused', pct, cur, dur);
            return;
          }
          // Fall through to full re-load for other errors
        }
      }
    }

    // 2. If a different audio note was playing, stop it first
    if (this.currentPlayingId && this.currentPlayingId !== messageId) {
      this.stop();
    }

    this.currentPlayingId = messageId;
    this.currentStatus = 'loading';
    this.notifyListeners('loading', 0, 0, safeDuration);

    if (this.isNative) {
      try {
        const streamUrl = `${cloudClient.getBaseUrl()}/v1/cloud/attachments/download-raw/${encodeURIComponent(meta.objectId)}`;
        const token = cloudClient.getSessionToken() || undefined;
        const staged = this.stagedSeekPercent[messageId];
        const startMs = staged ? (staged / 100) * (safeDuration * 1000) : 0;

        const success = await NativeMediaBridge.getInstance().playAudio({
          url: streamUrl,
          authToken: token,
          messageId,
          startPositionMs: startMs,
        });
        if (success) {
          this.currentStatus = 'playing';
          this.nativeIsPlaying = true;
          this.nativeCurrentTime = startMs / 1000;
          this.lastConfirmedNativeTime = this.nativeCurrentTime;
          if (typeof staged === 'number') {
            delete this.stagedSeekPercent[messageId];
          }
          const dur = this.getDuration(safeDuration);
          const cur = this.nativeCurrentTime;
          const pct = dur > 0 ? (cur / dur) * 100 : 0;
          this.notifyListeners('playing', pct, cur, dur, messageId);
          if (this.activeCallbacks?.onProgress) {
            this.activeCallbacks.onProgress(pct, cur, dur);
          }
          return;
        }
      } catch (_nativeErr) {
        // Fall back to web audio element below
      }
    }

    try {
      MediaLogger.log({
        event: 'DOWNLOAD_STARTED',
        objectId: meta.objectId,
        mimeType: meta.mimeType,
      });

      // 3. Obtain audio Blob URL (leveraging MediaCache for instant RAM/IndexedDB resolution)
      //    Reuse existing blob URL if we still have one for the same message
      let blobUrl: string;
      if (this.currentBlobUrl && this.currentPlayingId === messageId) {
        blobUrl = this.currentBlobUrl;
      } else {
        // Revoke previous blob URL if switching messages
        if (this.currentBlobUrl && typeof URL !== 'undefined') {
          try { URL.revokeObjectURL(this.currentBlobUrl); } catch (_e) {}
        }
        blobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(session, cloudClient, meta);
        this.currentBlobUrl = blobUrl;
      }

      MediaLogger.log({
        event: 'DECRYPTION_COMPLETED',
        objectId: meta.objectId,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      });

      // 4. Initialize or reuse stable Audio instance
      let audio: HTMLAudioElement;
      if (typeof Audio !== 'undefined') {
        audio = new Audio();
      } else if (typeof (globalThis as any).Audio !== 'undefined') {
        const AudioClass = (globalThis as any).Audio;
        audio = new AudioClass();
      } else {
        // Headless mock for testing environments
        audio = {
          src: '',
          currentTime: 0,
          duration: safeDuration || 1,
          paused: true,
          ended: false,
          readyState: 4,
          play: async () => { (audio as any).paused = false; },
          pause: () => { (audio as any).paused = true; },
          load: () => {},
        } as any;
      }

      // Clean up previous audio element's event listeners to prevent phantom errors
      if (this.currentAudio && this.currentAudio !== audio) {
        try {
          this.currentAudio.onloadedmetadata = null;
          this.currentAudio.oncanplay = null;
          this.currentAudio.ontimeupdate = null;
          this.currentAudio.onended = null;
          this.currentAudio.onerror = null;
          this.currentAudio.pause();
          this.currentAudio.src = '';
        } catch (_e) {}
      }

      this.currentAudio = audio;

      // Capture staged seek for this message
      const stagedSeek = this.stagedSeekPercent[messageId];
      let stagedSeekApplied = false;
      let stagedSeekCompleted: Promise<void> | null = null;

      const applyStagedSeek = () => {
        if (stagedSeekApplied || typeof stagedSeek !== 'number' || stagedSeek <= 0) return;
        const dur = this.getDuration(safeDuration);
        if (dur <= 0) return;

        stagedSeekApplied = true;
        const targetTime = (stagedSeek / 100) * dur;
        if (typeof audio.addEventListener !== 'function') {
          try { audio.currentTime = targetTime; } catch (_e) {}
          return;
        }

        stagedSeekCompleted = new Promise<void>((resolve) => {
          const onSeeked = () => {
            audio.removeEventListener('seeked', onSeeked);
            resolve();
          };
          audio.addEventListener('seeked', onSeeked);
          try {
            audio.currentTime = targetTime;
          } catch (_e) {
            audio.removeEventListener('seeked', onSeeked);
            resolve();
          }
        });
      };

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
          this.currentDuration = audio.duration;
        }

        const dur = this.getDuration(safeDuration);
        const cur = audio.currentTime || 0;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        this.notifyListeners(this.currentStatus, pct, cur, dur);

        MediaLogger.log({
          event: 'METADATA_LOADED',
          objectId: meta.objectId,
          duration: dur,
        });

        RuntimeDiagnostics.audio('metadataLoaded', {
          objectId: meta.objectId,
          duration: dur,
          mimeType: meta.mimeType,
        });
      };

      audio.oncanplay = () => {
        // `canplay` guarantees seeking is accepted; wait for `seeked` below
        // before play(), or Android WebView can still begin playback at zero.
        applyStagedSeek();

        RuntimeDiagnostics.audio('canPlay', {
          objectId: meta.objectId,
          duration: this.getDuration(safeDuration),
        });
      };

      audio.ontimeupdate = () => {
        const duration = this.getDuration(safeDuration) || 1;
        const currentTime = audio.currentTime || 0;
        const percent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

        this.notifyListeners(this.currentStatus, percent, currentTime, duration);
        if (this.activeCallbacks?.onProgress) {
          this.activeCallbacks.onProgress(percent, currentTime, duration);
        }
      };

      audio.onended = () => {
        MediaLogger.log({
          event: 'PLAYBACK_ENDED',
          objectId: meta.objectId,
        });
        const duration = this.getDuration(safeDuration);
        this.notifyListeners('idle', 0, 0, duration);
        this.stop();
        if (callbacks.onEnded) callbacks.onEnded();
      };

      audio.onerror = (e: any) => {
        // Ignore errors triggered by intentional pauses, stops, or src changes
        if (this.currentStatus === 'paused' || this.currentStatus === 'idle' || !this.currentPlayingId) return;
        // Ignore errors if this audio element is no longer the active one
        if (this.currentAudio !== audio) return;

        const err = new Error('Audio playback error occurred');
        MediaLogger.log({
          event: 'MEDIA_ERROR',
          objectId: meta.objectId,
          error: err.message,
        });
        RuntimeDiagnostics.audio('playbackError', {
          objectId: meta.objectId,
          error: String(e),
        });
        this.currentStatus = 'error';
        this.notifyListeners('error', 0, 0, safeDuration);
        if (callbacks.onError) callbacks.onError(err);
      };

      // Set source and start loading
      audio.src = blobUrl;
      audio.load();

      // 5. Wait for canplay before calling play() to prevent AbortError
      //    For mock/test environments with readyState >= 3, skip waiting
      if (typeof audio.readyState === 'number' && audio.readyState < 3 && typeof audio.addEventListener === 'function') {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('error', onError);
            resolve(); // Resolve anyway — onerror handler above will fire separately
          };
          audio.addEventListener('canplay', onReady);
          audio.addEventListener('error', onError);
        });
      }

      // A cached element can already be ready without emitting another canplay.
      if (typeof audio.readyState === 'number' && audio.readyState >= 3) {
        applyStagedSeek();
      }
      if (stagedSeekCompleted) {
        await stagedSeekCompleted;
      }

      // 6. Attempt playback with graceful error recovery
      try {
        await audio.play();
      } catch (playErr: any) {
        const errName = playErr?.name || '';
        // AbortError: load() interrupted play() — audio not ready yet
        // NotAllowedError: browser autoplay policy blocked the call
        if (errName === 'AbortError' || errName === 'NotAllowedError') {
          // Don't destroy the audio element — keep it loaded so user can tap again
          this.currentStatus = 'paused';
          const dur = this.getDuration(safeDuration);
          const cur = this.getCurrentTime();
          const pct = dur > 0 ? (cur / dur) * 100 : 0;
          this.notifyListeners('paused', pct, cur, dur);
          RuntimeDiagnostics.audio('playRecoverableError', {
            objectId: meta.objectId,
            errorName: errName,
            messageId,
          });
          return; // Do NOT throw — user can re-tap to play
        }
        // For other errors, fall through to the catch block below
        throw playErr;
      }

      this.currentStatus = 'playing';
      const initialDur = this.getDuration(safeDuration);
      const initialCur = audio.currentTime || 0;
      const initialPct = initialDur > 0 ? (initialCur / initialDur) * 100 : 0;
      this.notifyListeners('playing', initialPct, initialCur, initialDur);

      // Clear staged seek now that playback started successfully
      delete this.stagedSeekPercent[messageId];

      MediaLogger.log({
        event: 'PLAYBACK_STARTED',
        objectId: meta.objectId,
        duration: initialDur,
      });

      RuntimeDiagnostics.audio('playbackStarted', {
        objectId: meta.objectId,
        duration: initialDur,
        messageId,
      });
    } catch (err: any) {
      this.currentStatus = 'error';
      this.notifyListeners('error', 0, 0, safeDuration);
      this.stop();
      if (callbacks.onError) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
      throw err;
    }
  }

  /**
   * Pauses active playback immediately without destroying the audio element or revoking URLs.
   */
  public pause(): void {
    if (this.isNative) {
      NativeMediaBridge.getInstance().pauseAudio();
      this.currentStatus = 'paused';
      this.nativeIsPlaying = false;
      const dur = this.getDuration();
      const cur = this.getCurrentTime();
      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      this.notifyListeners('paused', pct, cur, dur);
      if (this.activeCallbacks?.onProgress) {
        this.activeCallbacks.onProgress(pct, cur, dur);
      }
      return;
    }
    if (this.currentAudio && !this.currentAudio.paused) {
      try {
        this.currentAudio.pause();
      } catch (_e) {}
      this.currentStatus = 'paused';
      const dur = this.getDuration();
      const cur = this.getCurrentTime();
      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      this.notifyListeners('paused', pct, cur, dur);
      if (this.activeCallbacks?.onProgress) {
        this.activeCallbacks.onProgress(pct, cur, dur);
      }
      RuntimeDiagnostics.audio('pauseExecuted', {
        messageId: this.currentPlayingId,
        currentTime: cur,
      });
    }
  }

  /**
   * Resumes playback if currently paused.
   */
  public async resume(): Promise<void> {
    if (this.isNative) {
      if (this.currentPlayingId && this.currentStatus === 'paused') {
        const staged = this.stagedSeekPercent[this.currentPlayingId];
        if (typeof staged === 'number') {
          const dur = this.getDuration();
          const targetTime = (staged / 100) * dur;
          const seekRes = await NativeMediaBridge.getInstance().seekAudio(Math.round(targetTime * 1000));
          if (seekRes && seekRes.success) {
            this.nativeCurrentTime = seekRes.currentPositionMs / 1000;
          }
          delete this.stagedSeekPercent[this.currentPlayingId];
        }
        await NativeMediaBridge.getInstance().resumeAudio();
        this.currentStatus = 'playing';
        this.nativeIsPlaying = true;
      }
      return;
    }
    if (this.currentAudio && this.currentAudio.paused && this.currentPlayingId) {
      try {
        const staged = this.stagedSeekPercent[this.currentPlayingId];
        if (typeof staged === 'number') {
          const dur = this.getDuration();
          if (dur > 0) {
            try {
              this.currentAudio.currentTime = (staged / 100) * dur;
            } catch (_e) {}
          }
          delete this.stagedSeekPercent[this.currentPlayingId];
        }
        await this.currentAudio.play();
        this.currentStatus = 'playing';
        const dur = this.getDuration();
        const cur = this.getCurrentTime();
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        this.notifyListeners('playing', pct, cur, dur);
        if (this.activeCallbacks?.onProgress) {
          this.activeCallbacks.onProgress(pct, cur, dur);
        }
      } catch (e: any) {
        const errName = e?.name || '';
        if (errName === 'AbortError' || errName === 'NotAllowedError') {
          this.currentStatus = 'paused';
          const dur = this.getDuration();
          const cur = this.getCurrentTime();
          const pct = dur > 0 ? (cur / dur) * 100 : 0;
          this.notifyListeners('paused', pct, cur, dur);
          return;
        }
      }
    }
  }

  /**
   * Dispatches authoritative native seek to ExoPlayer and reconciles confirmed position.
   */
  public async seekNative(
    positionMs: number,
    targetId?: string,
    durationSeconds?: number,
    previousTime?: number
  ): Promise<void> {
    const revision = ++this.pendingNativeSeekRevision;
    const fallbackTime = typeof previousTime === 'number' ? previousTime : this.lastConfirmedNativeTime;
    const dur = durationSeconds && durationSeconds > 0 ? durationSeconds : this.getDuration() || 1;

    try {
      const res = await NativeMediaBridge.getInstance().seekAudio(positionMs);
      if (this.pendingNativeSeekRevision !== revision) return;

      if (res && res.success) {
        this.nativeCurrentTime = res.currentPositionMs / 1000;
        this.lastConfirmedNativeTime = this.nativeCurrentTime;
        const actualPct = dur > 0 ? (this.nativeCurrentTime / dur) * 100 : 0;
        this.notifyListeners(
          this.currentPlayingId === targetId ? this.currentStatus : 'idle',
          actualPct,
          this.nativeCurrentTime,
          dur,
          targetId || undefined
        );
        if (this.activeCallbacks?.onProgress) {
          this.activeCallbacks.onProgress(actualPct, this.nativeCurrentTime, dur);
        }
      } else if (res && !res.superseded) {
        this.nativeCurrentTime = fallbackTime;
        this.lastConfirmedNativeTime = fallbackTime;
        const fallbackPct = dur > 0 ? (fallbackTime / dur) * 100 : 0;
        this.notifyListeners(
          this.currentPlayingId === targetId ? this.currentStatus : 'idle',
          fallbackPct,
          fallbackTime,
          dur,
          targetId || undefined
        );
        if (this.activeCallbacks?.onProgress) {
          this.activeCallbacks.onProgress(fallbackPct, fallbackTime, dur);
        }
      }
    } catch (_err) {
      if (this.pendingNativeSeekRevision !== revision) return;
      this.nativeCurrentTime = fallbackTime;
      this.lastConfirmedNativeTime = fallbackTime;
      const fallbackPct = dur > 0 ? (fallbackTime / dur) * 100 : 0;
      this.notifyListeners(
        this.currentPlayingId === targetId ? this.currentStatus : 'idle',
        fallbackPct,
        fallbackTime,
        dur,
        targetId || undefined
      );
      if (this.activeCallbacks?.onProgress) {
        this.activeCallbacks.onProgress(fallbackPct, fallbackTime, dur);
      }
    }
  }

  /**
   * Seeks playback position to a percentage (0 - 100).
   * Works whether audio is currently playing, paused, or staged before initial play.
   */
  public seek(percent: number, messageId?: string, durationSeconds?: number): void {
    const clampedPercent = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
    const targetId = messageId || this.currentPlayingId;

    if (targetId) {
      this.stagedSeekPercent[targetId] = clampedPercent;
      if (durationSeconds && durationSeconds > 0) {
        this.knownDurations[targetId] = durationSeconds;
      }
    }

    const duration =
      durationSeconds && durationSeconds > 0
        ? durationSeconds
        : this.getDuration() || 1;
    const targetTime = (clampedPercent / 100) * duration;
    let actualCurrentTime = targetTime;

    if (this.isNative) {
      const prevTime = this.lastConfirmedNativeTime > 0 ? this.lastConfirmedNativeTime : this.nativeCurrentTime;
      this.nativeCurrentTime = targetTime;
      this.notifyListeners(
        this.currentPlayingId === targetId ? this.currentStatus : 'idle',
        clampedPercent,
        targetTime,
        duration,
        targetId || undefined
      );
      if (this.activeCallbacks?.onProgress) {
        this.activeCallbacks.onProgress(clampedPercent, targetTime, duration);
      }

      if (this.currentPlayingId && (this.currentStatus === 'playing' || this.currentStatus === 'paused')) {
        this.seekNative(Math.round(targetTime * 1000), targetId || undefined, duration, prevTime);
      }
      return;
    }

    if (this.currentAudio && (!messageId || this.currentPlayingId === messageId)) {
      try {
        if (typeof this.currentAudio.readyState === 'undefined' || this.currentAudio.readyState !== 0) {
          this.currentAudio.currentTime = targetTime;
          actualCurrentTime = this.currentAudio.currentTime;
        } else {
          // If element explicitly has readyState === 0 (HAVE_NOTHING), keep staged
          actualCurrentTime = targetTime;
        }
      } catch (_e) {
        actualCurrentTime = targetTime;
      }
    }

    this.notifyListeners(
      this.currentPlayingId === targetId ? this.currentStatus : 'idle',
      clampedPercent,
      actualCurrentTime,
      duration,
      targetId || undefined
    );
    if (this.activeCallbacks?.onProgress) {
      this.activeCallbacks.onProgress(clampedPercent, actualCurrentTime, duration);
    }

    RuntimeDiagnostics.audio('seekRequested', {
      duration,
      seekRequested: clampedPercent,
      targetTime,
      actualCurrentTime,
      audioActive: !!this.currentAudio,
      messageId: targetId,
    });

    MediaLogger.log({
      event: 'SEEK_EXECUTED',
      seekPercent: clampedPercent,
      duration: targetTime,
    });
  }

  /**
   * Stops active playback, resets position to 0, and clears active session state.
   */
  public stop(): void {
    if (this.isNative) {
      NativeMediaBridge.getInstance().stopAudio();
      this.nativeIsPlaying = false;
      this.nativeCurrentTime = 0;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio.load();
      } catch (_e) {}
      this.currentAudio = null;
    }

    if (this.currentBlobUrl && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (_e) {}
      this.currentBlobUrl = null;
    }

    const previousId = this.currentPlayingId;
    this.currentPlayingId = null;
    this.currentStatus = 'idle';
    this.activeCallbacks = null;
    this.currentDuration = 0;

    if (previousId) {
      const set = this.listeners.get(previousId);
      if (set) {
        for (const l of set) {
          try {
            l('idle', 0, 0, 0);
          } catch (_e) {}
        }
      }
    }
  }
}

export const VoicePlayer = new VoicePlaybackManager();
