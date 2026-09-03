/**
 * Inline Decrypted Media Image & Video Thumbnail Component for VEIL.
 *
 * Automatically orchestrates authenticated cloud retrieval, cryptographic reassembly,
 * and ephemeral Blob URL generation with smooth loading skeleton and automatic dead-blob recovery.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../app/AppState.tsx';
import { MediaCache, DecryptedMedia, AttachmentPayload } from '../../utils/mediaCache.ts';
import { MediaLogger } from '../../utils/mediaLogger.ts';
import { ThumbnailGenerator } from '../../../attachments/thumbnailGenerator.ts';
import { PlayIcon, RefreshCwIcon, AlertCircleIcon } from '../icons/index.ts';

export interface MediaImageProps {
  attachment: AttachmentPayload;
  onClick?: () => void;
  alt?: string;
  className?: string;
  isVideo?: boolean;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  attachment,
  onClick,
  alt = 'Encrypted media',
  className = '',
  isVideo = false,
}) => {
  const { activeSession, cloudClient, ensureCloudSession } = useApp();
  const key = attachment.objectId || attachment.attachmentId || attachment.name;

  const [media, setMedia] = useState<DecryptedMedia | null>(() => {
    return (
      MediaCache.get(key) ||
      (attachment.objectId ? MediaCache.get(attachment.objectId) : undefined) ||
      (attachment.attachmentId ? MediaCache.get(attachment.attachmentId) : undefined) ||
      null
    );
  });

  const [isLoading, setIsLoading] = useState(!media && !attachment.previewUrl);
  const [error, setError] = useState<string | null>(null);
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchAndDecrypt = useCallback(
    async (forceRetry = false) => {
      if (!activeSession) return;
      if (forceRetry) {
        MediaCache.invalidate(key);
        if (attachment.objectId) MediaCache.invalidate(attachment.objectId);
        if (attachment.attachmentId) MediaCache.invalidate(attachment.attachmentId);
      }

      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      try {
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }

        MediaLogger.log({
          event: 'DECRYPTION_STARTED',
          attachmentId: attachment.attachmentId,
          objectId: attachment.objectId,
          mimeType: attachment.mimeType,
        });

        const result = await MediaCache.getOrFetch(attachment, activeSession, cloudClient);
        if (isMountedRef.current) {
          setMedia(result);
          setIsLoading(false);
          MediaLogger.log({
            event: 'DECRYPTION_COMPLETED',
            attachmentId: attachment.attachmentId,
            objectId: attachment.objectId,
            mimeType: attachment.mimeType,
            sizeBytes: result.sizeBytes,
          });
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err?.message || 'Media unavailable');
          setIsLoading(false);
          MediaLogger.log({
            event: 'MEDIA_ERROR',
            attachmentId: attachment.attachmentId,
            objectId: attachment.objectId,
            error: err?.message,
          });
        }
      }
    },
    [activeSession, cloudClient, ensureCloudSession, key, attachment]
  );

  useEffect(() => {
    const cached =
      MediaCache.get(key) ||
      (attachment.objectId ? MediaCache.get(attachment.objectId) : undefined) ||
      (attachment.attachmentId ? MediaCache.get(attachment.attachmentId) : undefined);

    if (cached) {
      setMedia(cached);
      setIsLoading(false);
      return;
    }

    if (attachment.objectId || attachment.attachmentId) {
      fetchAndDecrypt();
    } else if (!attachment.previewUrl) {
      setError('Attachment lacks objectId or attachmentId for cloud retrieval');
      setIsLoading(false);
    }
  }, [key, attachment.objectId, attachment.attachmentId, attachment.previewUrl, fetchAndDecrypt]);

  // Handle broken/stale blob image or video load failure
  const handleMediaError = () => {
    if (isMountedRef.current) {
      MediaCache.invalidate(key);
      if (attachment.objectId) MediaCache.invalidate(attachment.objectId);
      if (attachment.attachmentId) MediaCache.invalidate(attachment.attachmentId);
      fetchAndDecrypt(true);
    }
  };

  const displayBlobUrl = media?.blobUrl || attachment.previewUrl;
  const isVideoMedia = isVideo || attachment.mimeType?.startsWith('video/');
  const createdThumbUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isVideoMedia || !displayBlobUrl) return;

    let isCancelled = false;
    (async () => {
      try {
        let blobSource: Blob | null = null;
        if (media?.data) {
          blobSource = new Blob([media.data as any], { type: attachment.mimeType || 'video/mp4' });
        } else {
          const res = await fetch(displayBlobUrl);
          blobSource = await res.blob();
        }
        if (blobSource && !isCancelled) {
          const result = await ThumbnailGenerator.generateVideoThumbnail(blobSource, 0.5, 480);
          if (!isCancelled && result.previewUrl) {
            if (createdThumbUrlRef.current && createdThumbUrlRef.current.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
              try {
                URL.revokeObjectURL(createdThumbUrlRef.current);
              } catch (_e) {}
            }
            createdThumbUrlRef.current = result.previewUrl;
            setVideoThumbnailUrl(result.previewUrl);
            if (result.duration > 0) setVideoDuration(result.duration);
          }
        }
      } catch (_e) {
        // Fallback gracefully to video tag or direct url
      }
    })();

    return () => {
      isCancelled = true;
      if (createdThumbUrlRef.current && createdThumbUrlRef.current.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        try {
          URL.revokeObjectURL(createdThumbUrlRef.current);
        } catch (_e) {}
      }
    };
  }, [isVideoMedia, displayBlobUrl, media, attachment.mimeType]);

  if (isLoading && !displayBlobUrl) {
    return (
      <div
        className={`veil-media-thumbnail-loading ${className}`.trim()}
        role="progressbar"
        aria-label="Decrypting media..."
      >
        <div className="veil-media-skeleton-pulse" />
        <div className="veil-media-loading-badge">
          <span className="veil-spinner veil-spinner-sm" />
          <span>Decrypting</span>
        </div>
      </div>
    );
  }

  if (error && !displayBlobUrl) {
    return (
      <div className={`veil-media-thumbnail-error ${className}`.trim()} role="alert">
        <AlertCircleIcon size={22} color="var(--veil-danger)" />
        <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginTop: '2px', textAlign: 'center' }}>
          {error || 'Media unavailable'}
        </span>
        <button
          type="button"
          className="veil-btn veil-btn-secondary veil-btn-sm"
          onClick={() => fetchAndDecrypt(true)}
          style={{ marginTop: '0.4rem', padding: '0.25rem 0.6rem', gap: '4px' }}
        >
          <RefreshCwIcon size={14} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`veil-media-thumbnail-wrapper ${onClick ? 'veil-media-thumbnail-clickable' : ''} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`View ${isVideoMedia ? 'video' : 'photo'} ${attachment.name}`}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {displayBlobUrl ? (
        isVideoMedia ? (
          videoThumbnailUrl ? (
            <img
              src={videoThumbnailUrl}
              alt={alt || attachment.name}
              className="veil-media-thumbnail-img"
              loading="lazy"
              onError={() => setVideoThumbnailUrl(null)}
            />
          ) : (
            <video
              src={displayBlobUrl}
              className="veil-media-thumbnail-img veil-media-thumbnail-video"
              preload="metadata"
              muted
              playsInline
              onError={handleMediaError}
            />
          )
        ) : (
          <img
            src={displayBlobUrl}
            alt={alt || attachment.name}
            className="veil-media-thumbnail-img"
            loading="lazy"
            onError={handleMediaError}
          />
        )
      ) : (
        <div className="veil-media-skeleton-pulse" />
      )}

      {isVideoMedia && (
        <div className="veil-media-play-badge" aria-hidden="true">
          <PlayIcon size={26} color="#ffffff" />
          {videoDuration !== null && videoDuration > 0 && (
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#ffffff', marginLeft: '4px' }}>
              {Math.floor(videoDuration / 60)}:{(Math.floor(videoDuration % 60)).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
