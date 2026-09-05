/**
 * Native Media Bridge for VEIL.
 *
 * Interfaces with native Kotlin AndroidX Media3 ExoPlayer plugin (VeilNativeMedia)
 * when running on Android/Capacitor, ensuring:
 * - Authoritative native Media3 audio playback and lifecycle
 * - Automatic Audio Focus management (phone calls, other apps)
 * - Automatic pause on headphone disconnect (becoming noisy)
 * - Accurate seek and stream buffer handling
 * - Zero sensitive tokens in logs
 * - Clean web fallback to HTMLAudioElement when running in desktop/browser environments.
 */

import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core';

export interface PlaybackStateEvent {
  state: 'idle' | 'buffering' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
  isPlaying: boolean;
  currentPositionMs: number;
  durationMs: number;
  messageId: string;
}

export interface PlaybackProgressEvent {
  currentPositionMs: number;
  durationMs: number;
  messageId: string;
}

export interface PlaybackEndedEvent {
  state: 'ended';
  messageId: string;
  durationMs: number;
  currentPositionMs: number;
}

export interface PlaybackErrorEvent {
  state: 'error';
  errorCode?: string;
  message: string;
  messageId: string;
}

export interface VeilNativeMediaPluginInterface {
  playAudio(options: {
    url: string;
    authToken?: string;
    messageId?: string;
    startPositionMs?: number;
  }): Promise<{ success: boolean; messageId: string }>;

  pauseAudio(): Promise<{ success: boolean }>;

  resumeAudio(): Promise<{ success: boolean }>;

  seekAudio(options: { positionMs: number }): Promise<{
    success: boolean;
    currentPositionMs: number;
    durationMs: number;
  }>;

  stopAudio(): Promise<{ success: boolean }>;

  getPlaybackStatus(): Promise<{
    isPlaying: boolean;
    currentPositionMs: number;
    durationMs: number;
    messageId: string;
  }>;

  releaseAudio(): Promise<{ success: boolean }>;

  addListener(
    eventName: 'onPlaybackStateChange',
    listenerFunc: (data: PlaybackStateEvent) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onPlaybackProgress',
    listenerFunc: (data: PlaybackProgressEvent) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onPlaybackEnded',
    listenerFunc: (data: PlaybackEndedEvent) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onPlaybackError',
    listenerFunc: (data: PlaybackErrorEvent) => void
  ): Promise<PluginListenerHandle>;
}

export const VeilNativeMedia = registerPlugin<VeilNativeMediaPluginInterface>('VeilNativeMedia');

export class NativeMediaBridge {
  private static instance: NativeMediaBridge | null = null;
  private isNative: boolean;
  private activeHandles: PluginListenerHandle[] = [];

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  public static getInstance(): NativeMediaBridge {
    if (!NativeMediaBridge.instance) {
      NativeMediaBridge.instance = new NativeMediaBridge();
    }
    return NativeMediaBridge.instance;
  }

  public isSupported(): boolean {
    return this.isNative;
  }

  public async playAudio(params: {
    url: string;
    authToken?: string;
    messageId?: string;
    startPositionMs?: number;
  }): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await VeilNativeMedia.playAudio(params);
      return true;
    } catch (_err) {
      return false;
    }
  }

  public async pauseAudio(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await VeilNativeMedia.pauseAudio();
      return true;
    } catch (_err) {
      return false;
    }
  }

  public async resumeAudio(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await VeilNativeMedia.resumeAudio();
      return true;
    } catch (_err) {
      return false;
    }
  }

  public async seekAudio(positionMs: number): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await VeilNativeMedia.seekAudio({ positionMs });
      return true;
    } catch (_err) {
      return false;
    }
  }

  public async stopAudio(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await VeilNativeMedia.stopAudio();
      return true;
    } catch (_err) {
      return false;
    }
  }

  public async releaseAudio(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await VeilNativeMedia.releaseAudio();
      return true;
    } catch (_err) {
      return false;
    }
  }

  public async onStateChange(callback: (data: PlaybackStateEvent) => void): Promise<PluginListenerHandle | null> {
    if (!this.isNative) return null;
    try {
      const handle = await VeilNativeMedia.addListener('onPlaybackStateChange', callback);
      this.activeHandles.push(handle);
      return handle;
    } catch (_err) {
      return null;
    }
  }

  public async onProgress(callback: (data: PlaybackProgressEvent) => void): Promise<PluginListenerHandle | null> {
    if (!this.isNative) return null;
    try {
      const handle = await VeilNativeMedia.addListener('onPlaybackProgress', callback);
      this.activeHandles.push(handle);
      return handle;
    } catch (_err) {
      return null;
    }
  }

  public async onEnded(callback: (data: PlaybackEndedEvent) => void): Promise<PluginListenerHandle | null> {
    if (!this.isNative) return null;
    try {
      const handle = await VeilNativeMedia.addListener('onPlaybackEnded', callback);
      this.activeHandles.push(handle);
      return handle;
    } catch (_err) {
      return null;
    }
  }

  public async onError(callback: (data: PlaybackErrorEvent) => void): Promise<PluginListenerHandle | null> {
    if (!this.isNative) return null;
    try {
      const handle = await VeilNativeMedia.addListener('onPlaybackError', callback);
      this.activeHandles.push(handle);
      return handle;
    } catch (_err) {
      return null;
    }
  }
}
