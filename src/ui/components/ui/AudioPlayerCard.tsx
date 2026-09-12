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
  objectId?: string;
  attachmentId?: string;
  conversationId?: string;
  senderName?: string;
  isOutgoing?: boolean;
  status?: 'idle' | 'uploading' | 'downloading' | 'ready' | 'error';
  progressPercent?: number;
  loadedBytes?: number;
  onDownload?: () => void;
  onResolveAudio?: () => Promise<string | undefined>;
  className?: string;
}

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  messageId,
  name,
  sizeBytes,
  mimeType = 'audio/mpeg',
  blobUrl: propBlobUrl,
  objectId,
  attachmentId,
  conversationId,
  senderName,
  isOutgoing = false,
  status = 'ready',
  progressPercent = 0,
  loadedBytes = 0,
  onDownload,
  onResolveAudio,
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
  const autoPlayPendingRef = useRef(false);
  const targetSeekTimeRef = useRef(0);

  // Sync blobUrl from prop or cache if available
  useEffect(() => {
    if (propBlobUrl) {
      setResolvedBlobUrl(propBlobUrl);
      return;
    }
    const cached =
      (objectId ? MediaCache.get(objectId) : undefined) ||
      (attachmentId ? MediaCache.get(attachmentId) : undefined) ||
      MediaCache.get(name) ||
      MediaCache.get(messageId);
    if (cached?.blobUrl) {
      setResolvedBlobUrl(cached.blobUrl);
    }
  }, [messageId, objectId, attachmentId, name, propBlobUrl]);

  // Global listener: stop this audio if another audio or voice note starts playing
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ messageId?: string }>;
      if (customEvent.detail?.messageId !== messageId) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    };
    window.addEventListener('veil:audio:play', handleGlobalPlay);
    return () => {
      window.removeEventListener('veil:audio:play', handleGlobalPlay);
    };
  }, [messageId]);

  // Subscribe to unified VoicePlayer for this messageId
  useEffect(() => {
    const unsub = VoicePlayer.subscribe(messageId, (status, progress, cur, dur) => {
      setIsPlaying(status === 'playing');
      if (!isScrubbingRef.current) {
        setCurrentTime(cur);
        setProgressPercentState(progress);
      }
      if (dur > 0) {
        setDuration(dur);
      }
    });
    return unsub;
  }, [messageId]);

  // Manage single HTMLAudioElement lifecycle & event listeners
  useEffect(() => {
    if (!resolvedBlobUrl) return;

    let audio: HTMLAudioElement;
    const globalAudio = VoicePlayer.getCurrentAudio();
    if (VoicePlayer.getPlayingId() === messageId && globalAudio) {
      audio = globalAudio;
    } else {
      audio = new Audio(resolvedBlobUrl);
    }
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

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

    const onError = async () => {
      setIsPlaying(false);
      // Attempt self-healing recovery if blobUrl was invalidated
      const freshUrl = objectId
        ? MediaCache.refreshBlobUrl(objectId)
        : attachmentId
        ? MediaCache.refreshBlobUrl(attachmentId)
        : name
        ? MediaCache.refreshBlobUrl(name)
        : MediaCache.refreshBlobUrl(messageId);

      if (freshUrl && freshUrl !== resolvedBlobUrl) {
        setResolvedBlobUrl(freshUrl);
      } else if (onResolveAudio) {
        try {
          const reResolved = await onResolveAudio();
          if (reResolved) setResolvedBlobUrl(reResolved);
        } catch (_e) {}
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // If already playing in global VoicePlayer, sync state immediately
    if (VoicePlayer.getPlayingId() === messageId && VoicePlayer.isPlaying(messageId)) {
      setIsPlaying(true);
      setCurrentTime(audio.currentTime || 0);
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setProgressPercentState(((audio.currentTime || 0) / audio.duration) * 100);
      }
    }

    if (autoPlayPendingRef.current) {
      autoPlayPendingRef.current = false;
      VoicePlayer.stop();
      window.dispatchEvent(new CustomEvent('veil:audio:play', { detail: { messageId } }));
      audio.play().then(() => {
        VoicePlayer.playAudioTrack(
          resolvedBlobUrl,
          messageId,
          {
            title: name,
            senderName,
            conversationId,
            duration: audio.duration || duration,
          },
          {},
          audio
        );
      }).catch(() => setIsPlaying(false));
    }

    return () => {
      // NOTE: Do NOT pause if this track is the active global track playing in VoicePlayer
      if (VoicePlayer.getPlayingId() !== messageId) {
        audio.pause();
      }
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [resolvedBlobUrl, messageId, duration, name, conversationId, senderName, objectId, attachmentId, onResolveAudio]);

  const handlePlayToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If audio is currently uploading/downloading, let user wait
    if (status === 'uploading' || status === 'downloading') return;

    if (VoicePlayer.getPlayingId() === messageId) {
      if (VoicePlayer.isPlaying(messageId)) {
        VoicePlayer.pause();
        return;
      } else if (VoicePlayer.isPaused(messageId)) {
        await VoicePlayer.resume();
        return;
      }
    }

    // If we do not have a blobUrl, fetch and decrypt into memory (NEVER save to disk)
    if (!resolvedBlobUrl) {
      setIsResolving(true);
      try {
        let url: string | undefined;
        if (onResolveAudio) {
          url = await onResolveAudio();
        }
        if (!url) {
          const cached =
            (objectId ? MediaCache.get(objectId) : undefined) ||
            (attachmentId ? MediaCache.get(attachmentId) : undefined) ||
            MediaCache.get(name) ||
            MediaCache.get(messageId);
          url = cached?.blobUrl;
        }

        if (url) {
          autoPlayPendingRef.current = true;
          setResolvedBlobUrl(url);
        }
      } catch (_err) {
        setIsPlaying(false);
      } finally {
        setIsResolving(false);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      VoicePlayer.pause();
    } else {
      try {
        // Pause any other voice notes and audio players
        VoicePlayer.stop();
        window.dispatchEvent(new CustomEvent('veil:audio:play', { detail: { messageId } }));
        await audio.play();
        await VoicePlayer.playAudioTrack(
          resolvedBlobUrl,
          messageId,
          {
            title: name,
            senderName,
            conversationId,
            duration: audio.duration || duration,
          },
          {},
          audio
        );
      } catch (_err) {
        setIsPlaying(false);
      }
    }
  };

  const updateScrubberVisual = (clientX: number) => {
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = rect.width > 0 ? clampedX / rect.width : 0;
    const targetSeconds = percent * duration;

    targetSeekTimeRef.current = targetSeconds;
    setCurrentTime(targetSeconds);
    setProgressPercentState(percent * 100);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!audioRef.current || duration <= 0) return;

    isScrubbingRef.current = true;
    setIsScrubbing(true);
    updateScrubberVisual(e.clientX);

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

      updateScrubberVisual(upEvent.clientX);
      if (audioRef.current && isFinite(targetSeekTimeRef.current)) {
        audioRef.current.currentTime = targetSeekTimeRef.current;
        VoicePlayer.seekTime(targetSeekTimeRef.current);
      }
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
      onClick={(e) => {
        // Prevent clicking inside audio player from triggering message row context menu
        e.stopPropagation();
      }}
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
          onClick={(e) => {
            e.stopPropagation();
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
          }}
          role="slider"
          aria-valuenow={Math.round(progressPercentState)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Audio progress scrubber"
          data-no-swipe="true"
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
            {duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : formatTime(currentTime)}
          </span>
          <span className="veil-audio-player-size">
            {formatSize(sizeBytes)}
          </span>
        </div>
      </div>
    </div>
  );
};
