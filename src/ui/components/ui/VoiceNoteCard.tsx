import React from 'react';
import { Spinner } from './Spinner.tsx';
import { PlayIcon, PauseIcon, RefreshCwIcon, FileAudioIcon } from '../icons/index.ts';

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

  const stopAllEvents = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const timerDisplay =
    playbackState === 'playing' || playbackState === 'paused'
      ? `${formatDuration(currentTimeSeconds)} / ${formatDuration(durationSeconds)}`
      : formatDuration(durationSeconds);

  return (
    <div
      className={`veil-voicenote-card ${isOutgoing ? 'outgoing' : 'incoming'} ${className}`.trim()}
      role="region"
      aria-label={`${isOutgoing ? 'Sent' : 'Received'} Audio message`}
      onClick={stopAllEvents}
      onDoubleClick={stopAllEvents}
      onContextMenu={stopAllEvents}
      onPointerDown={stopAllEvents}
      onPointerMove={stopAllEvents}
      onPointerUp={stopAllEvents}
      onTouchStart={stopAllEvents}
      onTouchMove={stopAllEvents}
      onTouchEnd={stopAllEvents}
      onTouchCancel={stopAllEvents}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: '220px',
        maxWidth: '300px',
        padding: '8px 12px',
        borderRadius: 'var(--veil-radius-md, 12px)',
        background: isOutgoing
          ? 'var(--veil-accent-primary-subtle, rgba(99, 102, 241, 0.15))'
          : 'var(--veil-surface-elevated, rgba(255, 255, 255, 0.06))',
        border: '1px solid var(--veil-border-subtle, rgba(255, 255, 255, 0.08))',
        boxSizing: 'border-box',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {/* Play/Pause/Retry Button */}
        {isError ? (
          <button
            type="button"
            className="veil-voicenote-play-btn veil-voicenote-retry-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onRetry) onRetry();
              else if (onPlayToggle) onPlayToggle();
            }}
            onPointerDown={stopAllEvents}
            onTouchStart={stopAllEvents}
            aria-label="Retry audio note"
            title="Retry audio note"
            style={{
              width: '34px',
              height: '34px',
              minWidth: '34px',
              backgroundColor: 'var(--veil-danger, #ef4444)',
              color: '#ffffff',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCwIcon size={15} color="#ffffff" />
          </button>
        ) : (
          <button
            type="button"
            className="veil-voicenote-play-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlayToggle?.();
            }}
            onPointerDown={stopAllEvents}
            onTouchStart={stopAllEvents}
            disabled={isLoading || isUploading}
            aria-label={isUploading ? 'Uploading audio...' : isPlaying ? 'Pause voice message' : 'Play voice message'}
            title={isUploading ? 'Uploading...' : isPlaying ? 'Pause' : 'Play'}
            style={{
              width: '34px',
              height: '34px',
              minWidth: '34px',
              backgroundColor: 'var(--veil-accent-primary, #6366f1)',
              color: '#ffffff',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: isLoading || isUploading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            {isUploading || isLoading ? (
              <Spinner size="sm" aria-label="Loading audio..." />
            ) : isPlaying ? (
              <PauseIcon size={16} color="#ffffff" />
            ) : (
              <PlayIcon size={16} color="#ffffff" />
            )}
          </button>
        )}

        {/* Note Icon & Label */}
        <div className="veil-waveform-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          <FileAudioIcon size={16} color="var(--veil-accent-primary, #6366f1)" />
          <span
            style={{
              fontSize: 'var(--veil-text-xs, 12px)',
              fontWeight: 500,
              color: 'var(--veil-text-primary, #ffffff)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Audio message
          </span>
          <span className={`veil-waveform-bar ${isPlaying ? 'active' : ''}`} style={{ display: 'none' }} aria-hidden="true" />
        </div>

        {/* Timer */}
        <span
          style={{
            fontSize: 'var(--veil-text-xs, 11px)',
            color: 'var(--veil-text-secondary, rgba(255, 255, 255, 0.7))',
            minWidth: '40px',
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {isUploading ? 'Uploading...' : isError ? 'Failed' : timerDisplay}
        </span>
      </div>

      {/* Slender 2px Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '2px',
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '1px',
          overflow: 'hidden',
          marginTop: '2px',
          cursor: onSeek && !isUploading && !isError ? 'pointer' : 'default',
        }}
        onClick={(e) => {
          if (!onSeek || isUploading || isError) return;
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width > 0) {
            const clickPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            onSeek(clickPercent);
          }
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, currentProgressPercent))}%`,
            backgroundColor: isPlaying
              ? 'var(--veil-accent-primary, #6366f1)'
              : 'var(--veil-text-muted, rgba(255, 255, 255, 0.4))',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {/* Error Notice */}
      {(errorMessage || isError) && (
        <div
          style={{
            fontSize: 'var(--veil-text-xs, 11px)',
            color: 'var(--veil-danger, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '2px',
          }}
          role="alert"
        >
          <AlertCircleIcon size={12} />
          <span>{errorMessage || 'Playback error — tap retry'}</span>
        </div>
      )}
    </div>
  );
};
