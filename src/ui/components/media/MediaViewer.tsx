/**
 * Telegram & Signal-Inspired Fullscreen Media Viewer Component for VEIL.
 *
 * Implements high-fidelity media inspection with on-demand zero-knowledge decryption,
 * pinch/scroll zoom, pan, dedicated HTML5 video controls, and next/previous gallery navigation.
 */

import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { AppContext } from '../../app/AppState.tsx';
import { MediaCache, DecryptedMedia, AttachmentPayload } from '../../utils/mediaCache.ts';
import { MediaLogger } from '../../utils/mediaLogger.ts';
import { RuntimeDiagnostics } from '../../../debug/runtimeDiagnostics.ts';
import {
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  DownloadIcon,
  ShareIcon,
  PlayIcon,
  PauseIcon,
  VolumeIcon,
  VolumeXIcon,
  MaximizeIcon,
  RefreshCwIcon,
  AlertCircleIcon,
} from '../icons/index.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { Spinner } from '../ui/Spinner.tsx';

export interface MediaViewerItem {
  id: string;
  type: 'image' | 'video' | 'file';
  url: string;
  name: string;
  sizeBytes?: number;
  mimeType?: string;
  timestamp?: number;
  senderName?: string;
  attachment?: AttachmentPayload;
  data?: Uint8Array;
}

export interface MediaViewerProps {
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (item: MediaViewerItem) => void;
  onShare?: (item: MediaViewerItem) => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  items,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare,
}) => {
  const app = useContext(AppContext);
  const activeSession = app?.activeSession;
  const cloudClient = app?.cloudClient;
  const ensureCloudSession = app?.ensureCloudSession;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});

  // Image zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const currentItem = items[currentIndex] || items[0];
  const currentKey = currentItem?.attachment?.objectId || currentItem?.attachment?.attachmentId || currentItem?.id || currentItem?.name;
  const currentBlobUrl = resolvedUrls[currentKey] || currentItem?.url || MediaCache.get(currentKey)?.blobUrl || '';

  // Asynchronously resolve & decrypt media if not yet in memory
  const resolveCurrentMedia = useCallback(
    async (forceRetry = false) => {
      if (!currentItem) return;

      const key = currentItem.attachment?.objectId || currentItem.attachment?.attachmentId || currentItem.id || currentItem.name;

      if (!forceRetry) {
        const cached = MediaCache.get(key) || (currentItem.url ? { blobUrl: currentItem.url } : undefined);
        if (cached && cached.blobUrl) {
          setResolvedUrls((prev) => ({ ...prev, [key]: cached.blobUrl }));
          setLoadingMedia((prev) => ({ ...prev, [key]: false }));
          return;
        }
      }

      if (!currentItem.attachment || !activeSession) return;

      setLoadingMedia((prev) => ({ ...prev, [key]: true }));
      setMediaErrors((prev) => ({ ...prev, [key]: '' }));

      try {
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }

        MediaLogger.log({
          event: 'DECRYPTION_STARTED',
          attachmentId: currentItem.attachment.attachmentId,
          objectId: currentItem.attachment.objectId,
          mimeType: currentItem.mimeType,
        });

        const result = await MediaCache.getOrFetch(currentItem.attachment, activeSession, cloudClient);
        setResolvedUrls((prev) => ({ ...prev, [key]: result.blobUrl }));
        setLoadingMedia((prev) => ({ ...prev, [key]: false }));

        MediaLogger.log({
          event: 'DECRYPTION_COMPLETED',
          attachmentId: currentItem.attachment.attachmentId,
          objectId: currentItem.attachment.objectId,
          mimeType: currentItem.mimeType,
          sizeBytes: result.sizeBytes,
        });
      } catch (err: any) {
        setLoadingMedia((prev) => ({ ...prev, [key]: false }));
        setMediaErrors((prev) => ({ ...prev, [key]: err?.message || 'Failed to load media' }));
        MediaLogger.log({
          event: 'MEDIA_ERROR',
          attachmentId: currentItem.attachment.attachmentId,
          objectId: currentItem.attachment.objectId,
          error: err?.message,
        });
      }
    },
    [currentItem, activeSession, cloudClient, ensureCloudSession]
  );

  useEffect(() => {
    // Reset interaction state on item switch
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPlaying(false);
    setVideoProgress(0);
    setVideoDuration(0);
    setIsVideoLoading(true);

    resolveCurrentMedia();
  }, [currentIndex, resolveCurrentMedia]);

  // Clean up video decoder and listeners on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, []);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, items.length]);

  // Keyboard navigation & Esc listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === ' ' && currentItem?.type === 'video') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext, currentItem?.type]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.75, 4));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.75, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = () => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2.5);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Video playback controls
  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await videoRef.current.play();
        setIsPlaying(true);
      } catch (err: any) {
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      stageRef.current.requestFullscreen?.();
    }
  };

  const handleVideoSeek = (targetPercent: number) => {
    if (!videoRef.current || !videoDuration || !Number.isFinite(videoDuration) || videoDuration <= 0) return;
    const clampedPercent = Math.max(0, Math.min(100, Number.isFinite(targetPercent) ? targetPercent : 0));
    const targetSeconds = (clampedPercent / 100) * videoDuration;
    const clampedSeconds = Math.max(0, Math.min(videoDuration, targetSeconds));
    videoRef.current.currentTime = clampedSeconds;
    setVideoProgress(clampedSeconds);
    RuntimeDiagnostics.video('seekExecuted', {
      targetPercent: clampedPercent,
      targetSeconds: clampedSeconds,
      actualCurrentTime: videoRef.current.currentTime,
      duration: videoDuration,
    });
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!currentItem) return null;

  const isCurrentLoading = loadingMedia[currentKey] || (!currentBlobUrl && !mediaErrors[currentKey]);
  const currentError = mediaErrors[currentKey];

  return (
    <div
      className="veil-media-viewer-overlay"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      {/* Top Header Bar */}
      <div className="veil-media-viewer-header">
        <div className="veil-media-viewer-info">
          <div className="veil-media-viewer-title">{currentItem.name}</div>
          <div className="veil-media-viewer-meta">
            {currentItem.senderName && <span>{currentItem.senderName} • </span>}
            {items.length > 1 && <span>{currentIndex + 1} of {items.length} • </span>}
            {formatSize(currentItem.sizeBytes)}
          </div>
        </div>

        <div className="veil-media-viewer-actions">
          {currentItem.attachment?.allowSave === false && (
            <span
              style={{
                fontSize: 'var(--veil-text-xs)',
                color: 'var(--veil-text-secondary)',
                padding: '0.2rem 0.5rem',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 'var(--veil-radius-sm)',
                marginRight: '0.5rem',
              }}
            >
              Saving disabled by sender
            </span>
          )}

          {currentItem.type === 'image' && (
            <>
              <IconButton
                icon={<ZoomInIcon size={20} />}
                onClick={handleZoomIn}
                aria-label="Zoom In"
                variant="ghost"
              />
              <IconButton
                icon={<ZoomOutIcon size={20} />}
                onClick={handleZoomOut}
                aria-label="Zoom Out"
                variant="ghost"
                disabled={zoom <= 1}
              />
            </>
          )}

          {onShare && currentItem.attachment?.allowSave !== false && (
            <IconButton
              icon={<ShareIcon size={20} />}
              onClick={() => onShare({ ...currentItem, url: currentBlobUrl })}
              aria-label="Share media"
              variant="ghost"
            />
          )}

          {onDownload && currentItem.attachment?.allowSave !== false && (
            <IconButton
              icon={<DownloadIcon size={20} />}
              onClick={() => onDownload({ ...currentItem, url: currentBlobUrl })}
              aria-label="Download file"
              variant="ghost"
            />
          )}

          <IconButton
            icon={<CloseIcon size={20} />}
            onClick={onClose}
            aria-label="Close viewer"
            variant="ghost"
          />
        </div>
      </div>

      {/* Main Content Stage */}
      <div
        ref={stageRef}
        className="veil-media-viewer-stage"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {isCurrentLoading && (
          <div className="veil-media-thumbnail-loading" role="progressbar" aria-label="Decrypting media...">
            <Spinner size="md" />
            <span style={{ marginTop: '0.75rem', fontSize: 'var(--veil-text-sm)', color: '#ffffff' }}>
              Decrypting media...
            </span>
          </div>
        )}

        {currentError && !isCurrentLoading && (
          <div className="veil-media-thumbnail-error" role="alert" style={{ background: 'transparent' }}>
            <AlertCircleIcon size={32} color="var(--veil-danger)" />
            <span style={{ fontSize: 'var(--veil-text-sm)', color: '#ffffff', marginTop: '0.5rem' }}>
              {currentError}
            </span>
            <button
              type="button"
              className="veil-btn veil-btn-secondary veil-btn-sm"
              onClick={() => resolveCurrentMedia(true)}
              style={{ marginTop: '0.75rem', gap: '6px' }}
            >
              <RefreshCwIcon size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!isCurrentLoading && !currentError && currentBlobUrl && (
          <>
            {currentItem.type === 'image' && (
              <img
                src={currentBlobUrl}
                alt={currentItem.name}
                className="veil-media-viewer-img"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                }}
                draggable={false}
              />
            )}

            {currentItem.type === 'video' && (
              <div className="veil-media-viewer-video-container">
                <video
                  ref={videoRef}
                  src={currentBlobUrl}
                  className="veil-media-viewer-video"
                  playsInline
                  onClick={togglePlay}
                  onLoadedMetadata={(e) => {
                    const dur = (e.target as HTMLVideoElement).duration;
                    if (Number.isFinite(dur) && dur > 0) {
                      setVideoDuration(dur);
                    }
                    setIsVideoLoading(false);
                    RuntimeDiagnostics.video('metadataLoaded', {
                      duration: dur,
                      objectId: currentKey,
                    });
                  }}
                  onCanPlay={() => {
                    setIsVideoLoading(false);
                    RuntimeDiagnostics.video('canPlay', { objectId: currentKey });
                  }}
                  onWaiting={() => setIsVideoLoading(true)}
                  onPlaying={() => {
                    setIsPlaying(true);
                    setIsVideoLoading(false);
                    RuntimeDiagnostics.video('playing', { objectId: currentKey });
                  }}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => {
                    const target = e.target as HTMLVideoElement;
                    setVideoProgress(target.currentTime);
                    if (Number.isFinite(target.duration) && target.duration > 0) {
                      setVideoDuration(target.duration);
                    }
                  }}
                  onEnded={() => {
                    setIsPlaying(false);
                    setVideoProgress(0);
                    RuntimeDiagnostics.video('ended', { objectId: currentKey });
                  }}
                  onError={() => {
                    setIsVideoLoading(false);
                    setMediaErrors((prev) => ({ ...prev, [currentKey]: 'Video playback failed' }));
                    RuntimeDiagnostics.video('error', {
                      objectId: currentKey,
                      error: 'Video playback failed',
                    });
                  }}
                />

                {/* Floating Big Play Button Overlay */}
                {!isPlaying && !isVideoLoading && (
                  <button
                    type="button"
                    className="veil-media-viewer-play-overlay"
                    onClick={togglePlay}
                    aria-label="Play video"
                  >
                    <PlayIcon size={44} color="#ffffff" />
                  </button>
                )}

                {isVideoLoading && (
                  <div className="veil-media-viewer-loading-overlay">
                    <Spinner size="md" />
                  </div>
                )}

                {/* Custom Sleek Video Controls Bar */}
                <div className="veil-media-viewer-video-controls">
                  <IconButton
                    icon={isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                    variant="primary"
                  />

                  <div className="veil-media-viewer-progress-wrapper">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 0}
                      onChange={(e) => handleVideoSeek(parseFloat(e.target.value))}
                      className="veil-media-viewer-seek"
                      aria-label="Video scrubber"
                    />
                  </div>

                  <div className="veil-media-viewer-time">
                    {formatTime(videoProgress)} / {formatTime(videoDuration)}
                  </div>

                  <IconButton
                    icon={isMuted ? <VolumeXIcon size={18} /> : <VolumeIcon size={18} />}
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    variant="ghost"
                  />

                  <IconButton
                    icon={<MaximizeIcon size={18} />}
                    onClick={toggleFullscreen}
                    aria-label="Fullscreen"
                    variant="ghost"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Previous Navigation Button */}
        {currentIndex > 0 && (
          <button
            type="button"
            className="veil-media-viewer-nav veil-media-viewer-nav-prev"
            onClick={handlePrev}
            aria-label="Previous media"
          >
            <ChevronLeftIcon size={28} />
          </button>
        )}

        {/* Next Navigation Button */}
        {currentIndex < items.length - 1 && (
          <button
            type="button"
            className="veil-media-viewer-nav veil-media-viewer-nav-next"
            onClick={handleNext}
            aria-label="Next media"
          >
            <ChevronRightIcon size={28} />
          </button>
        )}
      </div>
    </div>
  );
};
