/**
 * In-App Floating Audio Player Notification Banner for VEIL (Phase 94).
 *
 * Implements a modern floating glassmorphic audio player banner docked at the
 * top of the conversation view, matching Telegram / reference UI specifications:
 * - Glowing purple circular play/pause button
 * - Animated 4-bar equalizer waveform indicator
 * - Track title and tabular time elapsed/duration display
 * - Interactive speed selector ([ 1.5x ] pill cycling 1x -> 1.5x -> 2x -> 1x)
 * - Jump button ([ Jump ]) smoothly scrolling to the active message
 * - Rewind 10s button ([ Rewind 10 ])
 * - Speaker volume / mute toggle (Volume2Icon / VolumeXIcon)
 * - Close button to stop playback and dismiss
 * - Full-width bottom edge interactive scrubber progress bar
 *
 * Strict Phase 44a Zero Literal Unicode Emoji compliance.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlayIcon,
  PauseIcon,
  CloseIcon,
  Volume2Icon,
  VolumeXIcon,
  Rewind10Icon,
  ExternalLinkIcon,
} from '../icons/index.ts';
import { VoicePlayer, ActiveTrackMetadata } from '../../../attachments/voicePlayer.ts';

export interface ActiveAudioBannerProps {
  onJumpToMessage?: (messageId: string, conversationId?: string) => void;
  className?: string;
}

export const ActiveAudioBanner: React.FC<ActiveAudioBannerProps> = ({
  onJumpToMessage,
  className = '',
}) => {
  const [activeTrack, setActiveTrack] = useState<ActiveTrackMetadata | null>(() => VoicePlayer.getActiveTrack());
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);

  const scrubberRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  // Subscribe to active audio track changes
  useEffect(() => {
    const unsub = VoicePlayer.subscribeActiveTrack((track) => {
      setActiveTrack(track);
    });
    return unsub;
  }, []);

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleTogglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeTrack) return;
    if (activeTrack.isPlaying) {
      VoicePlayer.pause();
    } else {
      VoicePlayer.resume();
    }
  }, [activeTrack]);

  const handleCycleSpeed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentRate = VoicePlayer.getPlaybackRate();
    let nextRate = 1.0;
    if (currentRate === 1.0) nextRate = 1.5;
    else if (currentRate === 1.5) nextRate = 2.0;
    else nextRate = 1.0;

    VoicePlayer.setPlaybackRate(nextRate);
  }, []);

  const handleRewind10 = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeTrack) return;
    const target = Math.max(0, activeTrack.currentTime - 10);
    VoicePlayer.seekTime(target);
  }, [activeTrack]);

  const handleToggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    VoicePlayer.toggleMute();
  }, []);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    VoicePlayer.stop();
  }, []);

  const handleJump = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTrack && onJumpToMessage) {
      onJumpToMessage(activeTrack.id, activeTrack.conversationId);
    }
  }, [activeTrack, onJumpToMessage]);

  // Scrubber calculation & seeking
  const updateScrubberVisual = useCallback((clientX: number) => {
    if (!scrubberRef.current || !activeTrack || activeTrack.duration <= 0) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = rect.width > 0 ? (clampedX / rect.width) * 100 : 0;
    setScrubPercent(percent);
    return percent;
  }, [activeTrack]);

  const handleScrubberPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (!activeTrack || activeTrack.duration <= 0) return;

    isScrubbingRef.current = true;
    setIsScrubbing(true);
    const initialPercent = updateScrubberVisual(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.stopPropagation();
      updateScrubberVisual(moveEvent.clientX);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.stopPropagation();
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const finalPercent = updateScrubberVisual(upEvent.clientX);
      setScrubPercent(null);
      if (activeTrack && activeTrack.duration > 0) {
        VoicePlayer.seek(finalPercent, activeTrack.id, activeTrack.duration);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [activeTrack, updateScrubberVisual]);

  if (!activeTrack) {
    return null;
  }

  const duration = activeTrack.duration || 0;
  const currentTime = activeTrack.currentTime || 0;
  const progressPercent = isScrubbing && scrubPercent !== null
    ? scrubPercent
    : duration > 0
    ? (currentTime / duration) * 100
    : 0;

  const playbackRate = activeTrack.playbackRate || 1.0;
  const rateLabel = playbackRate === 1.0 ? '1.0x' : playbackRate === 1.5 ? '1.5x' : `${playbackRate}x`;

  return (
    <div
      className={`veil-active-audio-banner ${className}`.trim()}
      role="region"
      aria-label="Active audio playback notification"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="veil-active-audio-body">
        {/* Play/Pause circular glowing button */}
        <button
          type="button"
          className="veil-active-audio-btn-play"
          onClick={handleTogglePlay}
          aria-label={activeTrack.isPlaying ? 'Pause audio' : 'Play audio'}
          title={activeTrack.isPlaying ? 'Pause' : 'Play'}
        >
          {activeTrack.isPlaying ? (
            <PauseIcon size={20} color="#ffffff" />
          ) : (
            <PlayIcon size={20} color="#ffffff" style={{ marginLeft: '2px' }} />
          )}
        </button>

        {/* Center info: title & subrow */}
        <div className="veil-active-audio-info">
          <div className="veil-active-audio-title-row">
            {/* Animated Equalizer */}
            <div
              className={`veil-active-audio-equalizer ${activeTrack.isPlaying ? 'playing' : 'paused'}`}
              aria-hidden="true"
            >
              <span className="veil-eq-bar veil-eq-bar-1" />
              <span className="veil-eq-bar veil-eq-bar-2" />
              <span className="veil-eq-bar veil-eq-bar-3" />
              <span className="veil-eq-bar veil-eq-bar-4" />
            </div>

            <span className="veil-active-audio-title" title={activeTrack.title}>
              {activeTrack.title}
            </span>
          </div>

          <div className="veil-active-audio-subrow">
            <span className="veil-active-audio-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <span className="veil-active-audio-dot" aria-hidden="true">·</span>

            {/* Playback speed pill button */}
            <button
              type="button"
              className="veil-active-audio-speed-btn"
              onClick={handleCycleSpeed}
              title="Change playback speed"
              aria-label={`Playback speed: ${rateLabel}`}
            >
              {rateLabel}
            </button>

            <span className="veil-active-audio-dot" aria-hidden="true">·</span>

            {/* Jump to message button */}
            <button
              type="button"
              className="veil-active-audio-jump-btn"
              onClick={handleJump}
              title="Jump to message in conversation"
              aria-label="Jump to message"
            >
              <ExternalLinkIcon size={13} color="currentColor" />
              <span>Jump</span>
            </button>
          </div>
        </div>

        {/* Right action controls */}
        <div className="veil-active-audio-actions">
          {/* Rewind 10s */}
          <button
            type="button"
            className="veil-active-audio-action-btn"
            onClick={handleRewind10}
            title="Rewind 10 seconds"
            aria-label="Rewind 10 seconds"
          >
            <Rewind10Icon size={18} color="currentColor" />
          </button>

          {/* Mute/Volume toggle */}
          <button
            type="button"
            className="veil-active-audio-action-btn"
            onClick={handleToggleMute}
            title={activeTrack.isMuted ? 'Unmute audio' : 'Mute audio'}
            aria-label={activeTrack.isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {activeTrack.isMuted ? (
              <VolumeXIcon size={18} color="currentColor" />
            ) : (
              <Volume2Icon size={18} color="currentColor" />
            )}
          </button>

          {/* Close/Stop button */}
          <button
            type="button"
            className="veil-active-audio-action-btn veil-active-audio-btn-close"
            onClick={handleClose}
            title="Stop and close player"
            aria-label="Stop and close player"
          >
            <CloseIcon size={16} color="currentColor" />
          </button>
        </div>
      </div>

      {/* Bottom edge scrubber track */}
      <div
        ref={scrubberRef}
        className="veil-active-audio-scrubber-track"
        onPointerDown={handleScrubberPointerDown}
        role="slider"
        aria-label="Audio progress scrubber"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
      >
        <div
          className="veil-active-audio-scrubber-fill"
          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
        />
      </div>
    </div>
  );
};
