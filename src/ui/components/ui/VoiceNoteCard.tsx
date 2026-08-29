/**
 * Reusable VoiceNoteCard Presentation Component for VEIL.
 *
 * Implements audio note player presentation with SVG play/pause controls,
 * dynamic waveform bars, interactive click/drag scrubbing, and current/total duration timer.
 */

import React, { useRef, useCallback, useState } from 'react';
import { Spinner } from './Spinner.tsx';
import { Progress } from './Progress.tsx';
import { PlayIcon, PauseIcon } from '../icons/index.ts';

export type VoicePlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface VoiceNoteCardProps {
  durationSeconds: number;
  currentTimeSeconds?: number;
  playbackState?: VoicePlaybackState;
  currentProgressPercent?: number;
  onPlayToggle?: () => void;
  onSeek?: (percent: number) => void;
  errorMessage?: string;
  className?: string;
}

export const VoiceNoteCard: React.FC<VoiceNoteCardProps> = ({
  durationSeconds,
  currentTimeSeconds = 0,
  playbackState = 'idle',
  currentProgressPercent = 0,
  onPlayToggle,
  onSeek,
  errorMessage,
  className = '',
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const formatDuration = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';

  const calculatePercentFromPointer = useCallback((clientX: number) => {
    if (!waveformRef.current) return 0;
    const rect = waveformRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const clickX = clientX - rect.left;
    return Math.max(0, Math.min(100, (clickX / rect.width) * 100));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    e.preventDefault();
    setIsScrubbing(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_e) {}

    const percent = calculatePercentFromPointer(e.clientX);
    onSeek(percent);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || !onSeek) return;
    e.preventDefault();
    const percent = calculatePercentFromPointer(e.clientX);
    onSeek(percent);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_e) {}
    if (onSeek) {
      const percent = calculatePercentFromPointer(e.clientX);
      onSeek(percent);
    }
  };

  const handlePointerCancel = () => {
    setIsScrubbing(false);
  };

  const timerDisplay =
    playbackState === 'playing' || playbackState === 'paused' || isScrubbing
      ? `${formatDuration(currentTimeSeconds)} / ${formatDuration(durationSeconds)}`
      : formatDuration(durationSeconds);

  return (
    <div className={`veil-voicenote-card ${className}`.trim()} role="region" aria-label="Voice Note Player">
      <button
        type="button"
        className="veil-voicenote-play-btn"
        onClick={onPlayToggle}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        title={isPlaying ? 'Pause' : 'Play'}
        style={{ minWidth: '40px', minHeight: '40px' }}
      >
        {isLoading ? (
          <Spinner size="sm" aria-label="Decrypting audio..." />
        ) : isPlaying ? (
          <PauseIcon size={16} color="#ffffff" />
        ) : (
          <PlayIcon size={16} color="#ffffff" />
        )}
      </button>

      <div className="veil-voicenote-content" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div
            ref={waveformRef}
            className="veil-waveform-container"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            style={{ cursor: onSeek ? 'pointer' : 'default', touchAction: 'none' }}
            aria-label="Audio waveform scrubber"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(currentProgressPercent)}
          >
            {[4, 12, 18, 8, 16, 22, 14, 6, 18, 10, 15, 20, 12, 16, 8, 14].map((h, i) => {
              const barPercent = (i / 16) * 100;
              const isFilled = currentProgressPercent >= barPercent;
              return (
                <span
                  key={i}
                  className={`veil-waveform-bar ${isPlaying ? 'active' : ''} ${isFilled ? 'played' : ''}`}
                  style={{
                    height: isPlaying ? undefined : `${h}px`,
                    animationDelay: `${i * 0.06}s`,
                  }}
                />
              );
            })}
          </div>
          <span className="veil-voice-timer" style={{ fontSize: 'var(--veil-text-xs)', minWidth: '48px', textAlign: 'right' }}>
            {timerDisplay}
          </span>
        </div>

        {playbackState !== 'idle' && (
          <div style={{ marginTop: '4px' }}>
            <Progress value={currentProgressPercent} aria-label="Playback progress" />
          </div>
        )}

        {errorMessage && (
          <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-danger)', marginTop: '4px' }} role="alert">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};
