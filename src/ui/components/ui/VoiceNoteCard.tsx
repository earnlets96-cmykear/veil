/**
 * Reusable VoiceNoteCard Presentation Component for VEIL.
 *
 * Implements audio note player presentation with SVG play/pause controls,
 * dynamic waveform bars, progress scrubber, and duration timer.
 */

import React from 'react';
import { Spinner } from './Spinner.tsx';
import { Progress } from './Progress.tsx';
import { PlayIcon, PauseIcon } from '../icons/index.ts';

export type VoicePlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface VoiceNoteCardProps {
  durationSeconds: number;
  playbackState?: VoicePlaybackState;
  currentProgressPercent?: number;
  onPlayToggle?: () => void;
  onSeek?: (percent: number) => void;
  errorMessage?: string;
  className?: string;
}

export const VoiceNoteCard: React.FC<VoiceNoteCardProps> = ({
  durationSeconds,
  playbackState = 'idle',
  currentProgressPercent = 0,
  onPlayToggle,
  onSeek,
  errorMessage,
  className = '',
}) => {
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    onSeek(percent);
  };

  return (
    <div className={`veil-voicenote-card ${className}`.trim()} role="region" aria-label="Voice Note Player">
      <button
        type="button"
        className="veil-voicenote-play-btn"
        onClick={onPlayToggle}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <Spinner size="sm" aria-label="Decrypting audio..." />
        ) : isPlaying ? (
          <PauseIcon size={16} color="#ffffff" />
        ) : (
          <PlayIcon size={16} color="#ffffff" />
        )}
      </button>

      <div className="veil-voicenote-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div
            className="veil-waveform-container"
            onClick={handleWaveformClick}
            style={{ cursor: onSeek ? 'pointer' : 'default' }}
            aria-hidden="true"
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
          <span className="veil-voice-timer">
            {formatDuration(durationSeconds)}
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
