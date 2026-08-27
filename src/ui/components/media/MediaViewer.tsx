/**
 * Telegram-Inspired Fullscreen Media Viewer Component for VEIL.
 *
 * Implements high-fidelity image inspection (pinch/scroll zoom, pan), HTML5 video playback
 * with sleek controls, next/previous gallery navigation, and direct file saving/sharing.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  DownloadIcon,
  ShareIcon,
  PlayIcon,
  PauseIcon,
  VolumeIcon,
  VolumeXIcon,
} from '../icons/index.ts';
import { IconButton } from '../ui/IconButton.tsx';

export interface MediaViewerItem {
  id: string;
  type: 'image' | 'video' | 'file';
  url: string;
  name: string;
  sizeBytes?: number;
  mimeType?: string;
  timestamp?: number;
  senderName?: string;
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
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentItem = items[currentIndex] || items[0];

  // Reset zoom and pan when navigating items
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPlaying(false);
  }, [currentIndex]);

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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Pan interaction
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

  // Video playback toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
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
          {currentItem.type === 'image' && (
            <>
              <IconButton
                icon={<ZoomInIcon />}
                onClick={handleZoomIn}
                ariaLabel="Zoom In"
                size="md"
                variant="ghost"
              />
              <IconButton
                icon={<ZoomOutIcon />}
                onClick={handleZoomOut}
                ariaLabel="Zoom Out"
                size="md"
                variant="ghost"
                disabled={zoom <= 1}
              />
            </>
          )}

          {onShare && (
            <IconButton
              icon={<ShareIcon />}
              onClick={() => onShare(currentItem)}
              ariaLabel="Share media"
              size="md"
              variant="ghost"
            />
          )}

          {onDownload && (
            <IconButton
              icon={<DownloadIcon />}
              onClick={() => onDownload(currentItem)}
              ariaLabel="Download file"
              size="md"
              variant="ghost"
            />
          )}

          <IconButton
            icon={<CloseIcon />}
            onClick={onClose}
            ariaLabel="Close viewer"
            size="md"
            variant="ghost"
          />
        </div>
      </div>

      {/* Main Content Stage */}
      <div
        className="veil-media-viewer-stage"
        onMouseDown={handleMouseDown}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {currentItem.type === 'image' && (
          <img
            src={currentItem.url}
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
              src={currentItem.url}
              className="veil-media-viewer-video"
              playsInline
              onClick={togglePlay}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setVideoProgress(videoRef.current.currentTime);
                  setVideoDuration(videoRef.current.duration || 0);
                }
              }}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Custom Sleek Video Controls Bar */}
            <div className="veil-media-viewer-video-controls">
              <IconButton
                icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
                onClick={togglePlay}
                ariaLabel={isPlaying ? 'Pause video' : 'Play video'}
                size="sm"
                variant="primary"
              />

              <div className="veil-media-viewer-progress-wrapper">
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 100}
                  value={videoProgress}
                  onChange={(e) => {
                    const targetTime = parseFloat(e.target.value);
                    if (videoRef.current) {
                      videoRef.current.currentTime = targetTime;
                      setVideoProgress(targetTime);
                    }
                  }}
                  className="veil-media-viewer-seek"
                />
              </div>

              <div className="veil-media-viewer-time">
                {formatTime(videoProgress)} / {formatTime(videoDuration)}
              </div>

              <IconButton
                icon={isMuted ? <VolumeXIcon /> : <VolumeIcon />}
                onClick={toggleMute}
                ariaLabel={isMuted ? 'Unmute' : 'Mute'}
                size="sm"
                variant="ghost"
              />
            </div>
          </div>
        )}

        {/* Previous Navigation Button */}
        {currentIndex > 0 && (
          <button
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
