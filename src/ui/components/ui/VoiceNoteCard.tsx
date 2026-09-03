import React, { useRef, useCallback, useState } from 'react';
import { Spinner } from './Spinner.tsx';
import { Progress } from './Progress.tsx';
import { PlayIcon, PauseIcon, RefreshCwIcon, AlertCircleIcon } from '../icons/index.ts';

export type VoicePlaybackState = 'idle' | 'ready' | 'loading' | 'uploading' | 'playing' | 'paused' | 'error';

export interface VoiceNoteCardProps {
  durationSeconds: number;
  currentTimeSeconds?: number;
  playbackState?: VoicePlaybackState;
  isOutgoing?: boolean;
  currentProgressPercent?: number;
  onPlayToggle?: () => void;
  onSeek?: (percent: number) => void;
  onRetry?: () => void;
  errorMessage?: string;
  className?: string;
}

export const VoiceNoteCard: React.FC<VoiceNoteCardProps> = ({
  durationSeconds,
  currentTimeSeconds = 0,
  playbackState = 'idle',
  isOutgoing = false,
  currentProgressPercent = 0,
  onPlayToggle,
  onSeek,
  onRetry,
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
  const isUploading = playbackState === 'uploading';
  const isError = playbackState === 'error';

  const calculatePercentFromPointer = useCallback((clientX: number) => {
    if (!waveformRef.current) return 0;
    const rect = waveformRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const clickX = clientX - rect.left;
    return Math.max(0, Math.min(100, (clickX / rect.width) * 100));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek || isUploading || isError) return;
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
    <div
      className={`veil-voicenote-card ${isOutgoing ? 'outgoing' : 'incoming'} ${className}`.trim()}
      role="region"
      aria-label={`${isOutgoing ? 'Sent' : 'Received'} Voice Note Player`}
    >
      {isError ? (
        <button
          type="button"
          className="veil-voicenote-play-btn veil-voicenote-retry-btn"
          onClick={onRetry || onPlayToggle}
          aria-label="Retry voice note"
          title="Retry voice note"
          style={{ minWidth: '40px', minHeight: '40px', backgroundColor: 'var(--veil-danger, #ef4444)' }}
        >
          <RefreshCwIcon size={16} color="#ffffff" />
        </button>
      ) : (
        <button
          type="button"
          className="veil-voicenote-play-btn"
          onClick={onPlayToggle}
          disabled={isLoading || isUploading}
          aria-label={isUploading ? 'Uploading voice message...' : isPlaying ? 'Pause voice message' : 'Play voice message'}
          title={isUploading ? 'Uploading...' : isPlaying ? 'Pause' : 'Play'}
          style={{ minWidth: '40px', minHeight: '40px' }}
        >
          {isUploading ? (
            <Spinner size="sm" aria-label="Uploading audio..." />
          ) : isLoading ? (
            <Spinner size="sm" aria-label="Decrypting audio..." />
          ) : isPlaying ? (
            <PauseIcon size={16} color="#ffffff" />
          ) : (
            <PlayIcon size={16} color="#ffffff" />
          )}
        </button>
      )}

      <div className="veil-voicenote-content" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div
            ref={waveformRef}
            className="veil-waveform-container"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            style={{ cursor: onSeek && !isUploading && !isError ? 'pointer' : 'default', touchAction: 'none' }}
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
          <span className="veil-voice-timer" style={{ fontSize: 'var(--veil-text-xs)', minWidth: '48px', textAlign: 'right', opacity: 0.85 }}>
            {isUploading ? 'Uploading...' : isError ? 'Failed' : timerDisplay}
          </span>
        </div>

        {playbackState !== 'idle' && playbackState !== 'ready' && !isUploading && !isError && (
          <div style={{ marginTop: '4px' }}>
            <Progress value={currentProgressPercent} aria-label="Playback progress" />
          </div>
        )}

        {(errorMessage || isError) && (
          <div
            style={{
              fontSize: 'var(--veil-text-xs)',
              color: 'var(--veil-danger)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            role="alert"
          >
            <AlertCircleIcon size={12} />
            <span>{errorMessage || 'Voice note unavailable — tap retry'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
