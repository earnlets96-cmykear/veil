import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Spinner } from './Spinner.tsx';
import { PlayIcon, PauseIcon, RefreshCwIcon, FileAudioIcon, AlertCircleIcon } from '../icons/index.ts';
import { VoicePlayer, VoicePlaybackStatus } from '../../../attachments/voicePlayer.ts';

export type VoicePlaybackState = 'idle' | 'ready' | 'loading' | 'uploading' | 'playing' | 'paused' | 'error';

export interface VoiceNoteCardProps {
  messageId?: string;
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
  messageId,
  durationSeconds,
  currentTimeSeconds: propCurrentTime = 0,
  playbackState: propPlaybackState = 'idle',
  isOutgoing = false,
  currentProgressPercent: propProgressPercent = 0,
  onPlayToggle,
  onSeek,
  onRetry,
  errorMessage,
  className = '',
}) => {
  // Local state for smooth, isolated playback tracking (prevents full timeline re-renders)
  const [localStatus, setLocalStatus] = useState<VoicePlaybackStatus>('idle');
  const [localProgress, setLocalProgress] = useState(propProgressPercent);
  const [localCurrentTime, setLocalCurrentTime] = useState(propCurrentTime);
  const [localDuration, setLocalDuration] = useState(durationSeconds);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Subscribe directly to VoicePlayer events if messageId is available
  useEffect(() => {
    if (!messageId) return;

    const unsub = VoicePlayer.subscribe(messageId, (status, progress, currentTime, dur) => {
      setLocalStatus(status);
      if (!isScrubbing) {
        setLocalProgress(progress);
        setLocalCurrentTime(currentTime);
      }
      if (dur > 0) {
        setLocalDuration(dur);
      }
    });

    return unsub;
  }, [messageId, isScrubbing]);

  // Sync prop changes if not currently playing locally
  useEffect(() => {
    if (!messageId || localStatus === 'idle') {
      setLocalProgress(propProgressPercent);
      setLocalCurrentTime(propCurrentTime);
      if (durationSeconds > 0) setLocalDuration(durationSeconds);
    }
  }, [propProgressPercent, propCurrentTime, durationSeconds, messageId, localStatus]);

  const effectiveDuration = localDuration || durationSeconds || 1;
  const effectiveCurrentTime = localCurrentTime;
  const effectiveProgress = Math.max(0, Math.min(100, localProgress));

  // Determine active visual state
  const isUploading = propPlaybackState === 'uploading';
  const isPropError = propPlaybackState === 'error';
  const isLocalError = localStatus === 'error';
  const isError = isPropError || isLocalError;
  const isLoading = propPlaybackState === 'loading' || localStatus === 'loading';
  const isPlaying = localStatus === 'playing' || (!messageId && propPlaybackState === 'playing');
  const isPaused = localStatus === 'paused' || (!messageId && propPlaybackState === 'paused');

  const formatDuration = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Complete event barrier: stops swipe-to-reply, parent clicks, context menus, and text selection
  const stopAllEvents = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleSeekFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setLocalProgress(percent);
      const targetTime = (percent / 100) * effectiveDuration;
      setLocalCurrentTime(targetTime);

      if (onSeek) {
        onSeek(percent);
      } else if (messageId) {
        VoicePlayer.seek(percent, messageId);
      }
    },
    [effectiveDuration, onSeek, messageId]
  );

  // Mouse / Touch scrubbing handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isUploading || isError) return;
    setIsScrubbing(true);
    handleSeekFromClientX(e.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();
      handleSeekFromClientX(moveEvent.clientX);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      upEvent.stopPropagation();
      upEvent.preventDefault();
      setIsScrubbing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const timerDisplay =
    isPlaying || isPaused
      ? `${formatDuration(effectiveCurrentTime)} / ${formatDuration(effectiveDuration)}`
      : formatDuration(effectiveDuration);

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
        gap: '6px',
        width: '260px',
        minWidth: '240px',
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
      {/* Top Header: Play/Pause/Retry Button + Label + Duration */}
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
              width: '32px',
              height: '32px',
              minWidth: '32px',
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
            <RefreshCwIcon size={14} color="#ffffff" />
          </button>
        ) : (
          <button
            type="button"
            className="veil-voicenote-play-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onPlayToggle) {
                onPlayToggle();
              } else if (messageId) {
                if (isPlaying) {
                  VoicePlayer.pause();
                } else if (isPaused) {
                  VoicePlayer.resume();
                }
              }
            }}
            onPointerDown={stopAllEvents}
            onTouchStart={stopAllEvents}
            disabled={isLoading || isUploading}
            aria-label={isUploading ? 'Uploading audio...' : isPlaying ? 'Pause voice message' : 'Play voice message'}
            title={isUploading ? 'Uploading...' : isPlaying ? 'Pause' : 'Play'}
            style={{
              width: '32px',
              height: '32px',
              minWidth: '32px',
              backgroundColor: 'var(--veil-accent-primary, #6366f1)',
              color: '#ffffff',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: isLoading || isUploading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
          >
            {isUploading || isLoading ? (
              <Spinner size="sm" aria-label="Loading audio..." />
            ) : isPlaying ? (
              <PauseIcon size={14} color="#ffffff" />
            ) : (
              <PlayIcon size={14} color="#ffffff" />
            )}
          </button>
        )}

        {/* Audio Label & Vector Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          <FileAudioIcon size={15} color="var(--veil-accent-primary, #6366f1)" />
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
        </div>

        {/* Duration Timer */}
        <span
          style={{
            fontSize: 'var(--veil-text-xs, 11px)',
            color: 'var(--veil-text-secondary, rgba(255, 255, 255, 0.7))',
            minWidth: '36px',
            textAlign: 'right',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isUploading ? 'Uploading...' : isError ? 'Failed' : timerDisplay}
        </span>
      </div>

      {/* Single Subtle Integrated Scrubbing Bar */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onTouchStart={stopAllEvents}
        onTouchMove={stopAllEvents}
        onTouchEnd={stopAllEvents}
        style={{
          width: '100%',
          height: '14px',
          display: 'flex',
          alignItems: 'center',
          cursor: isUploading || isError ? 'default' : 'pointer',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
            borderRadius: '2px',
            position: 'relative',
          }}
        >
          {/* Active Fill */}
          <div
            style={{
              height: '100%',
              width: `${effectiveProgress}%`,
              backgroundColor: isPlaying || isPaused
                ? 'var(--veil-accent-primary, #6366f1)'
                : 'var(--veil-text-muted, rgba(255, 255, 255, 0.4))',
              borderRadius: '2px',
              transition: isScrubbing ? 'none' : 'width 0.08s linear',
            }}
          />
          {/* Scrubbing Thumb */}
          {(isPlaying || isPaused || isScrubbing) && (
            <div
              style={{
                position: 'absolute',
                left: `${effectiveProgress}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: isScrubbing ? '10px' : '8px',
                height: isScrubbing ? '10px' : '8px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
                transition: isScrubbing ? 'none' : 'left 0.08s linear',
              }}
            />
          )}
        </div>
      </div>

      {/* Error Message */}
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
