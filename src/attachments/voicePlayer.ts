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
  private stagedSeekPercent: Record<string, number> = {};
  private listeners: Map<string, Set<VoicePlaybackListener>> = new Map();
  private isNative: boolean = false;
  private nativeCurrentTime: number = 0;
  private nativeDuration: number = 0;
  private nativeIsPlaying: boolean = false;

  constructor() {
    this.isNative = NativeMediaBridge.getInstance().isSupported();
    if (this.isNative) {
      const bridge = NativeMediaBridge.getInstance();
      bridge.onStateChange((e) => {
        this.nativeIsPlaying = e.isPlaying;
        this.nativeCurrentTime = (e.currentPositionMs || 0) / 1000;
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
    const duration = isCurrent ? this.getDuration() : 0;
    const currentTime = isCurrent ? this.getCurrentTime() : 0;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
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
    duration: number
  ): void {
    this.currentStatus = status;
    if (!this.currentPlayingId) return;
    const set = this.listeners.get(this.currentPlayingId);
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

    // 1. If this exact message is already loaded and paused, resume immediately!
    if (this.currentPlayingId === messageId && this.currentStatus === 'paused') {
      if (this.isNative) {
        await NativeMediaBridge.getInstance().resumeAudio();
        return;
      }
      if (this.currentAudio && this.currentAudio.paused) {
        try {
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
          // Fall through to full re-load if resume was interrupted
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
      const blobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(session, cloudClient, meta);
      this.currentBlobUrl = blobUrl;

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

      this.currentAudio = audio;

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
          this.currentDuration = audio.duration;
        }

        // Apply any pre-play staged seek position
        const staged = this.stagedSeekPercent[messageId];
        if (typeof staged === 'number' && staged > 0) {
          const target = (staged / 100) * this.getDuration(safeDuration);
          try {
            audio.currentTime = target;
          } catch (_e) {}
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
        // Ignore errors triggered by intentional pauses or stops
        if (this.currentStatus === 'paused' || !this.currentPlayingId) return;

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

      // Set initial seek if available
      const staged = this.stagedSeekPercent[messageId];
      if (typeof staged === 'number' && staged > 0) {
        const duration = this.getDuration(safeDuration) || 1;
        try {
          audio.currentTime = (staged / 100) * duration;
        } catch (_e) {}
      }

      await audio.play();
      this.currentStatus = 'playing';
      const initialDur = this.getDuration(safeDuration);
      const initialCur = audio.currentTime || 0;
      const initialPct = initialDur > 0 ? (initialCur / initialDur) * 100 : 0;
      this.notifyListeners('playing', initialPct, initialCur, initialDur);

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
        await NativeMediaBridge.getInstance().resumeAudio();
        this.currentStatus = 'playing';
        this.nativeIsPlaying = true;
      }
      return;
    }
    if (this.currentAudio && this.currentAudio.paused && this.currentPlayingId) {
      try {
        await this.currentAudio.play();
        this.currentStatus = 'playing';
        const dur = this.getDuration();
        const cur = this.getCurrentTime();
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        this.notifyListeners('playing', pct, cur, dur);
        if (this.activeCallbacks?.onProgress) {
          this.activeCallbacks.onProgress(pct, cur, dur);
        }
      } catch (_e) {}
    }
  }

  /**
   * Seeks playback position to a percentage (0 - 100).
   * Works whether audio is currently playing, paused, or staged before initial play.
   */
  public seek(percent: number, messageId?: string): void {
    const clampedPercent = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
    const targetId = messageId || this.currentPlayingId;

    if (targetId) {
      this.stagedSeekPercent[targetId] = clampedPercent;
    }

    const duration = this.getDuration() || 1;
    const targetTime = (clampedPercent / 100) * duration;
    let actualCurrentTime = targetTime;

    if (this.isNative) {
      this.nativeCurrentTime = targetTime;
      NativeMediaBridge.getInstance().seekAudio(targetTime * 1000);
      this.notifyListeners(this.currentStatus, clampedPercent, targetTime, duration);
      if (this.activeCallbacks?.onProgress) {
        this.activeCallbacks.onProgress(clampedPercent, targetTime, duration);
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

    this.notifyListeners(this.currentStatus, clampedPercent, actualCurrentTime, duration);
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
