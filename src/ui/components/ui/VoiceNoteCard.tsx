/**
 * Reusable VoiceNoteCard Presentation Component for VEIL.
 *
 * Implements audio note player presentation with play/pause controls,
 * animated waveform bars, progress bar, and duration timer.
 */

import React from 'react';
import { Spinner } from './Spinner.tsx';
import { Progress } from './Progress.tsx';

export type VoicePlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface VoiceNoteCardProps {
  durationSeconds: number;
  playbackState?: VoicePlaybackState;
  currentProgressPercent?: number;
  onPlayToggle?: () => void;
  errorMessage?: string;
  className?: string;
}

export const VoiceNoteCard: React.FC<VoiceNoteCardProps> = ({
  durationSeconds,
  playbackState = 'idle',
  currentProgressPercent = 0,
  onPlayToggle,
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
          '⏸'
        ) : (
          '▶'
        )}
      </button>

      <div className="veil-voicenote-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div className="veil-waveform-container" aria-hidden="true">
            {[4, 12, 18, 8, 16, 22, 14, 6, 18, 10, 15, 20].map((h, i) => (
              <span
                key={i}
                className={`veil-waveform-bar ${isPlaying ? 'active' : ''}`}
                style={{
                  height: isPlaying ? undefined : `${h}px`,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            ))}
          </div>
          <span className="veil-voice-timer">
            {formatDuration(durationSeconds)}
          </span>
        </div>

        {playbackState !== 'idle' && (
          <Progress value={currentProgressPercent} aria-label="Playback progress" />
        )}

        {errorMessage && (
          <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-danger)' }} role="alert">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};
