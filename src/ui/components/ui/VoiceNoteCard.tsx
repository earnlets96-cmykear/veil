import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Spinner } from './Spinner.tsx';
import { PlayIcon, PauseIcon, RefreshCwIcon, AlertCircleIcon } from '../icons/index.ts';
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

// Generate deterministic waveform bar heights from messageId
const generateWaveformBars = (messageId: string | undefined, count: number): number[] => {
  const bars: number[] = [];
  // Use a simple hash from messageId for deterministic but varied waveforms
  let seed = 0;
  const id = messageId || 'default';
  for (let i = 0; i < id.length; i++) {
    seed = ((seed << 5) - seed + id.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < count; i++) {
    // Simple pseudo-random from seed
    seed = (seed * 16807 + 12345) & 0x7fffffff;
    const normalized = (seed % 1000) / 1000;
    // Range from 0.2 to 1.0 to avoid invisible bars
    bars.push(0.2 + normalized * 0.8);
  }
  return bars;
};

const BAR_COUNT = 40;

const VoiceNoteCardComponent: React.FC<VoiceNoteCardProps> = ({
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
  const [localStatus, setLocalStatus] = useState<VoicePlaybackStatus>('idle');
  const [localProgress, setLocalProgress] = useState(propProgressPercent);
  const [localCurrentTime, setLocalCurrentTime] = useState(propCurrentTime);
  const [localDuration, setLocalDuration] = useState(durationSeconds);
  const isScrubbingRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const seekThrottleTimerRef = useRef<any>(null);
  const pendingSeekRef = useRef<{ percent: number; revision: number } | null>(null);
  const seekRevisionRef = useRef<number>(0);
  const pointerActiveRef = useRef<boolean>(false);
  const prevPropProgressRef = useRef(propProgressPercent);
  const prevPropTimeRef = useRef(propCurrentTime);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const SPEED_OPTIONS = [1, 1.5, 2];

  // Generate waveform bars once per messageId
  const waveformBars = useMemo(() => generateWaveformBars(messageId, BAR_COUNT), [messageId]);

  // Subscribe directly to VoicePlayer events — use ref for scrubbing to avoid re-mounting
  useEffect(() => {
    if (!messageId) return;

    const unsub = VoicePlayer.subscribe(messageId, (status, progress, currentTime, dur) => {
      setLocalStatus(status);
      if (!isScrubbingRef.current) {
        setLocalProgress(progress);
        setLocalCurrentTime(currentTime);
      }
      if (dur > 0) {
        setLocalDuration(dur);
      }
    });

    return unsub;
  }, [messageId]);

  // Sync prop changes only when prop values genuinely change from parent
  useEffect(() => {
    const progressChanged = prevPropProgressRef.current !== propProgressPercent;
    const timeChanged = prevPropTimeRef.current !== propCurrentTime;
    prevPropProgressRef.current = propProgressPercent;
    prevPropTimeRef.current = propCurrentTime;

    if (!isScrubbingRef.current && pendingSeekRef.current === null && (progressChanged || timeChanged)) {
      setLocalProgress(propProgressPercent);
      setLocalCurrentTime(propCurrentTime);
    }
    if (durationSeconds > 0) setLocalDuration(durationSeconds);
  }, [propProgressPercent, propCurrentTime, durationSeconds]);

  const effectiveDuration = localDuration || durationSeconds || 1;
  const effectiveCurrentTime = localCurrentTime;
  const effectiveProgress = Math.max(0, Math.min(100, localProgress));

  const isUploading = propPlaybackState === 'uploading';
  const isPropError = propPlaybackState === 'error';
  const isLocalError = localStatus === 'error';
  const isError = isPropError || isLocalError;
  const isLoading = propPlaybackState === 'loading' || localStatus === 'loading';
  const isPlaying = localStatus === 'playing' || propPlaybackState === 'playing';
  const isPaused = localStatus === 'paused' || propPlaybackState === 'paused';

  const formatDuration = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stopAllEvents = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const executeSeek = useCallback(
    (percent: number, revision: number) => {
      // Ignore if a newer seek revision was already dispatched or committed
      if (revision < seekRevisionRef.current) return;
      if (onSeek) {
        onSeek(percent);
      } else if (messageId) {
        VoicePlayer.seek(percent, messageId, effectiveDuration);
      }
    },
    [onSeek, messageId, effectiveDuration]
  );

  const handleSeekFromClientX = useCallback(
    (clientX: number, commitImmediately = false) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setLocalProgress(percent);
      const targetTime = (percent / 100) * effectiveDuration;
      setLocalCurrentTime(targetTime);

      if (commitImmediately) {
        if (seekThrottleTimerRef.current) {
          clearTimeout(seekThrottleTimerRef.current);
          seekThrottleTimerRef.current = null;
        }
        pendingSeekRef.current = null;
        const currentRev = ++seekRevisionRef.current;
        executeSeek(percent, currentRev);
      } else {
        const currentRev = ++seekRevisionRef.current;
        pendingSeekRef.current = { percent, revision: currentRev };
        if (!seekThrottleTimerRef.current) {
          seekThrottleTimerRef.current = setTimeout(() => {
            seekThrottleTimerRef.current = null;
            if (pendingSeekRef.current) {
              const { percent: p, revision: r } = pendingSeekRef.current;
              executeSeek(p, r);
            }
          }, 80);
        }
      }
    },
    [effectiveDuration, executeSeek]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (isUploading || isError) return;
    pointerActiveRef.current = true;
    isScrubbingRef.current = true;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch (_e) {}

    handleSeekFromClientX(e.clientX, false);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();
      handleSeekFromClientX(moveEvent.clientX, false);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      upEvent.stopPropagation();
      upEvent.preventDefault();
      isScrubbingRef.current = false;
      handleSeekFromClientX(upEvent.clientX, true);
      try {
        target.releasePointerCapture(upEvent.pointerId);
      } catch (_e) {}
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      setTimeout(() => {
        pointerActiveRef.current = false;
      }, 150);
    };

    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleTouchStartTrack = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pointerActiveRef.current) return;
    e.stopPropagation();
    if (isUploading || isError) return;
    isScrubbingRef.current = true;
    if (e.touches && e.touches[0]) {
      handleSeekFromClientX(e.touches[0].clientX, false);
    }
  };

  const handleTouchMoveTrack = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pointerActiveRef.current) return;
    e.stopPropagation();
    if (!isScrubbingRef.current) return;
    if (e.touches && e.touches[0]) {
      handleSeekFromClientX(e.touches[0].clientX, false);
    }
  };

  const handleTouchEndTrack = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pointerActiveRef.current) return;
    e.stopPropagation();
    isScrubbingRef.current = false;
    if (e.changedTouches && e.changedTouches[0]) {
      handleSeekFromClientX(e.changedTouches[0].clientX, true);
    }
  };

  const handleClickTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pointerActiveRef.current || isScrubbingRef.current) return;
    e.stopPropagation();
    if (isUploading || isError) return;
    handleSeekFromClientX(e.clientX, true);
  };

  const timerDisplay =
    isPlaying || isPaused
      ? formatDuration(effectiveCurrentTime)
      : formatDuration(effectiveDuration);

  const totalDisplay = isPlaying || isPaused ? formatDuration(effectiveDuration) : '';

  const handleSpeedCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const currentIdx = SPEED_OPTIONS.indexOf(playbackSpeed);
    const nextSpeed = SPEED_OPTIONS[(currentIdx + 1) % SPEED_OPTIONS.length];
    setPlaybackSpeed(nextSpeed);
    // Apply speed to VoicePlayer's HTMLAudioElement
    try {
      const audio = (VoicePlayer as any).currentAudio as HTMLAudioElement | null;
      if (audio) audio.playbackRate = nextSpeed;
    } catch {}
  };

  return (
    <div
      className={`veil-voicenote-card ${isOutgoing ? 'outgoing' : 'incoming'} ${className}`.trim()}
      role="region"
      aria-label={`${isOutgoing ? 'Sent' : 'Received'} Audio message voice note`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        minWidth: '200px',
        maxWidth: '320px',
        padding: '8px 12px',
        borderRadius: 'var(--veil-radius-md, 14px)',
        background: 'transparent',
        boxSizing: 'border-box',
        userSelect: 'none',
        position: 'relative',
      }}
    >
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
            width: '42px',
            height: '42px',
            minWidth: '42px',
            backgroundColor: 'var(--veil-danger, #ef4444)',
            color: '#ffffff',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'transform 0.15s ease',
          }}
        >
          <RefreshCwIcon size={16} color="#ffffff" />
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
            width: '42px',
            height: '42px',
            minWidth: '42px',
            backgroundColor: 'var(--veil-accent-primary, #14b8a6)',
            color: '#ffffff',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: isLoading || isUploading ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'transform 0.15s ease, background-color 0.15s ease',
            animation: isLoading ? 'veilPulse 1.4s infinite' : undefined,
          }}
        >
          {isUploading || isLoading ? (
            <Spinner size="sm" aria-label="Loading audio..." />
          ) : isPlaying ? (
            <PauseIcon size={18} color="#ffffff" />
          ) : (
            <PlayIcon size={18} color="#ffffff" />
          )}
        </button>
      )}

      {/* Waveform + Timer */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Waveform Bars */}
        <div
          ref={trackRef}
          className="veil-waveform-container"
          onPointerDown={handlePointerDown}
          onClick={handleClickTrack}
          onTouchStart={handleTouchStartTrack}
          onTouchMove={handleTouchMoveTrack}
          onTouchEnd={handleTouchEndTrack}
          onTouchCancel={handleTouchEndTrack}
          style={{
            width: '100%',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5px',
            cursor: isUploading || isError ? 'default' : 'pointer',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {waveformBars.map((height, i) => {
            const barPercent = ((i + 0.5) / BAR_COUNT) * 100;
            const isFilled = barPercent <= effectiveProgress;
            const isActive = isPlaying || isPaused;

            return (
              <div
                key={i}
                className={`veil-waveform-bar ${isFilled && isActive ? 'active' : ''}`.trim()}
                style={{
                  flex: '1 1 0',
                  height: `${height * 100}%`,
                  minWidth: '2px',
                  borderRadius: '1.5px',
                  backgroundColor: isFilled && isActive
                    ? 'var(--veil-accent-primary, #14b8a6)'
                    : isFilled
                    ? 'var(--veil-accent-primary-hover, #0d9488)'
                    : isOutgoing
                    ? 'rgba(255, 255, 255, 0.3)'
                    : 'rgba(255, 255, 255, 0.18)',
                  transition: isScrubbingRef.current ? 'none' : 'background-color 0.12s ease',
                }}
              />
            );
          })}
        </div>

        {/* Timer Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
        }}>
          <span
            style={{
              fontSize: '11px',
              color: isOutgoing
                ? 'rgba(255, 255, 255, 0.75)'
                : 'var(--veil-text-secondary, rgba(255, 255, 255, 0.6))',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {isUploading ? 'Uploading...' : isError ? 'Failed' : timerDisplay}
          </span>
          {totalDisplay && (
            <span
              style={{
                fontSize: '11px',
                color: isOutgoing
                  ? 'rgba(255, 255, 255, 0.5)'
                  : 'var(--veil-text-muted, rgba(255, 255, 255, 0.4))',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totalDisplay}
            </span>
          )}
          {/* Playback Speed Toggle */}
          {(isPlaying || isPaused) && (
            <button
              type="button"
              className="veil-voicenote-speed-btn"
              onClick={handleSpeedCycle}
              onPointerDown={stopAllEvents}
              onTouchStart={stopAllEvents}
              aria-label={`Playback speed ${playbackSpeed}x`}
              title={`Speed: ${playbackSpeed}x`}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                color: 'var(--veil-accent-primary, #14b8a6)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                cursor: 'pointer',
                lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums',
                transition: 'background-color 0.12s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {playbackSpeed}x
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {(errorMessage || isError) && (
        <div
          style={{
            position: 'absolute',
            bottom: '-18px',
            left: '12px',
            fontSize: '10px',
            color: 'var(--veil-danger, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
          role="alert"
        >
          <AlertCircleIcon size={10} />
          <span>{errorMessage || 'Tap retry'}</span>
        </div>
      )}
    </div>
  );
};

export const VoiceNoteCard = React.memo(VoiceNoteCardComponent);
