/**
 * Dedicated In-Line Music / Audio Player Card for VEIL (Phase 82).
 *
 * Implements Telegram-style inline music playback with play/pause button,
 * dynamic seeking scrubber, track title, time/duration metadata, and save action.
 */

import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon, DownloadIcon } from '../icons/index.ts';
import { ProgressCircle } from './ProgressCircle.tsx';
import { Spinner } from './Spinner.tsx';
import { VoicePlayer } from '../../../attachments/voicePlayer.ts';
import { MediaCache } from '../../utils/mediaCache.ts';

export interface AudioPlayerCardProps {
  messageId: string;
  name: string;
  sizeBytes: number;
  mimeType?: string;
  blobUrl?: string;
  isOutgoing?: boolean;
  status?: 'idle' | 'uploading' | 'downloading' | 'ready' | 'error';
  progressPercent?: number;
  loadedBytes?: number;
  onDownload?: () => void;
  className?: string;
}

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  messageId,
  name,
  sizeBytes,
  mimeType = 'audio/mpeg',
  blobUrl: propBlobUrl,
  isOutgoing = false,
  status = 'ready',
  progressPercent = 0,
  loadedBytes = 0,
  onDownload,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progressPercentState, setProgressPercentState] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [resolvedBlobUrl, setResolvedBlobUrl] = useState<string | undefined>(propBlobUrl);
  const [isResolving, setIsResolving] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  // Sync blobUrl from cache if available
  useEffect(() => {
    if (propBlobUrl) {
      setResolvedBlobUrl(propBlobUrl);
      return;
    }
    const cached = MediaCache.get(messageId);
    if (cached?.blobUrl) {
      setResolvedBlobUrl(cached.blobUrl);
    }
  }, [messageId, propBlobUrl]);

  // Manage HTMLAudioElement lifecycle
  useEffect(() => {
    if (!resolvedBlobUrl) return;

    const audio = new Audio(resolvedBlobUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      if (isScrubbingRef.current) return;
      setCurrentTime(audio.currentTime);
      if (audio.duration > 0) {
        setProgressPercentState((audio.currentTime / audio.duration) * 100);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setProgressPercentState(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [resolvedBlobUrl]);

  const handlePlayToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If audio is currently uploading/downloading, let user wait
    if (status === 'uploading' || status === 'downloading') return;

    // If we do not have a blobUrl, trigger onDownload to fetch & decrypt
    if (!resolvedBlobUrl) {
      setIsResolving(true);
      try {
        if (onDownload) {
          await onDownload();
        }
        const cached = MediaCache.get(messageId);
        if (cached?.blobUrl) {
          setResolvedBlobUrl(cached.blobUrl);
        }
      } finally {
        setIsResolving(false);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        // Pause any other voice notes playing via VoicePlayer
        VoicePlayer.stop();
        await audio.play();
        setIsPlaying(true);
      } catch (_err) {
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (clientX: number) => {
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = clampedX / rect.width;
    const targetSeconds = percent * duration;

    setCurrentTime(targetSeconds);
    setProgressPercentState(percent * 100);

    if (audioRef.current) {
      audioRef.current.currentTime = targetSeconds;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    handleSeek(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      handleSeek(moveEvent.clientX);
    };

    const onPointerUp = () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`veil-audio-player-card ${isOutgoing ? 'outgoing veil-audio-player-outgoing' : 'incoming veil-audio-player-incoming'} ${className}`.trim()}
      role="region"
      aria-label={`Audio player for ${name}`}
      data-no-swipe="true"
    >
      {/* Play / Pause Circular Button */}
      <div className="veil-audio-player-btn-wrap">
        <button
          type="button"
          className="veil-audio-player-play-btn veil-audio-play-btn"
          onClick={handlePlayToggle}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          disabled={status === 'uploading' || status === 'downloading' || isResolving}
        >
          {isResolving ? (
            <Spinner size="xs" />
          ) : status === 'uploading' || status === 'downloading' ? (
            <ProgressCircle
              size={36}
              percent={progressPercent}
              totalBytes={sizeBytes}
              loadedBytes={loadedBytes}
              variant={status === 'uploading' ? 'upload' : 'download'}
            />
          ) : isPlaying ? (
            <PauseIcon size={18} color="#ffffff" />
          ) : (
            <PlayIcon size={18} color="#ffffff" />
          )}
        </button>
      </div>

      {/* Track Info & Scrubber */}
      <div className="veil-audio-player-body">
        <div className="veil-audio-player-header">
          <span className="veil-audio-player-title" title={name}>
            {name}
          </span>
          {onDownload && (
            <button
              type="button"
              className="veil-audio-player-download-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              title="Download audio file"
              aria-label="Download audio file"
            >
              <DownloadIcon size={15} />
            </button>
          )}
        </div>

        {/* Scrubber track */}
        <div
          ref={scrubberRef}
          className="veil-audio-player-track-wrap veil-audio-scrubber-track"
          onPointerDown={handlePointerDown}
          role="slider"
          aria-valuenow={Math.round(progressPercentState)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Audio progress scrubber"
        >
          <div className="veil-audio-player-track-bg">
            <div
              className="veil-audio-player-track-fill"
              style={{ width: `${Math.max(0, Math.min(100, progressPercentState))}%` }}
            />
          </div>
          <div
            className={`veil-audio-player-needle ${isScrubbing ? 'active' : ''}`}
            style={{ left: `${Math.max(0, Math.min(100, progressPercentState))}%` }}
          />
        </div>

        {/* Time and Size Subtitle */}
        <div className="veil-audio-player-footer">
          <span className="veil-audio-player-time">
            {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : formatSize(sizeBytes)}
          </span>
          <span className="veil-audio-player-size">
            {formatSize(sizeBytes)}
          </span>
        </div>
      </div>
    </div>
  );
};
