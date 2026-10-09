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
import { requireCloudSessionForAttachment } from '../../../network/requireCloudSessionForAttachment.ts';
import { ThumbnailGenerator } from '../../../attachments/thumbnailGenerator.ts';
import { PlayIcon, RefreshCwIcon, AlertCircleIcon } from '../icons/index.ts';
import { telegramStickerService } from '../../../media/telegramStickerService.ts';

export interface MediaImageProps {
  attachment: AttachmentPayload;
  onClick?: () => void;
  alt?: string;
  className?: string;
  isVideo?: boolean;
  preferFullResolution?: boolean;
}

const MediaImageComponent: React.FC<MediaImageProps> = ({
  attachment,
  onClick,
  alt = 'Encrypted media',
  className = '',
  isVideo = false,
  preferFullResolution = false,
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

  const durableThumbnail = [attachment.thumbnailUrl, attachment.previewUrl]
    .find((url) => Boolean(url && !url.startsWith('blob:'))) || null;

  // Blob URLs are trusted if in RAM cache, media state, or provided preview
  const activeBlobUrl = media?.blobUrl || null;
  const hasEncryptedSource = Boolean(attachment.objectId || attachment.attachmentId);
  const displayUrl = activeBlobUrl || (
    preferFullResolution && hasEncryptedSource
      ? null
      : durableThumbnail || (attachment as any).url || null
  );
  const isShowingThumbnail = !activeBlobUrl && Boolean(durableThumbnail);

  const [isLoading, setIsLoading] = useState(!media && !displayUrl);
  const [error, setError] = useState<string | null>(null);
  const [hasImgError, setHasImgError] = useState(false);
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string | null>(() => durableThumbnail || null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const isMountedRef = useRef(true);
  const stickerRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(() =>
    typeof window === 'undefined' || typeof IntersectionObserver === 'undefined'
  );

  const isSticker = Boolean(
    (attachment as any).isSticker ||
    attachment.mimeType?.includes('sticker') ||
    attachment.name?.endsWith('.sticker.webp') ||
    attachment.name?.includes('.sticker.')
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (stickerRetryTimerRef.current) {
        clearTimeout(stickerRetryTimerRef.current);
        stickerRetryTimerRef.current = null;
      }
    };
  }, []);

  // Decrypt only media near the active viewport. ConversationView keeps a
  // bounded history window mounted, so eager fetches here can still start
  // dozens of downloads and image/video decodes at once.
  useEffect(() => {
    if (isNearViewport) return;
    const target = viewportRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '480px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isNearViewport]);

  const attachmentRef = useRef(attachment);
  useEffect(() => {
    attachmentRef.current = attachment;
  }, [attachment]);

  const isFetchingRef = useRef(false);

  const fetchAndDecrypt = useCallback(
    async (forceRetry = false) => {
      if (!activeSession) return;
      const currentAtt = attachmentRef.current;
      if (isFetchingRef.current && !forceRetry) return;

      if (forceRetry) {
        const cacheKeys = new Set([key, currentAtt.objectId, currentAtt.attachmentId].filter(Boolean) as string[]);
        await Promise.all(Array.from(cacheKeys, (cacheKey) => MediaCache.invalidate(
          cacheKey,
          activeSession,
          currentAtt.objectId || currentAtt.attachmentId
        )));
      }

      if (isMountedRef.current && !activeBlobUrl) {
        setIsLoading(true);
        setError(null);
        setHasImgError(false);
      }

      isFetchingRef.current = true;
      try {
        await requireCloudSessionForAttachment(cloudClient, () => ensureCloudSession(activeSession));

        MediaLogger.log({
          event: 'DECRYPTION_STARTED',
          attachmentId: currentAtt.attachmentId,
          objectId: currentAtt.objectId,
          mimeType: currentAtt.mimeType,
        });

        const result = await MediaCache.getOrFetch(currentAtt, activeSession, cloudClient);
        if (isMountedRef.current) {
          setMedia(result);
          setIsLoading(false);
          setHasImgError(false);
          MediaLogger.log({
            event: 'DECRYPTION_COMPLETED',
            attachmentId: currentAtt.attachmentId,
            objectId: currentAtt.objectId,
            mimeType: currentAtt.mimeType,
            sizeBytes: result.sizeBytes,
          });
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err?.message || 'Media unavailable');
          setIsLoading(false);
          MediaLogger.log({
            event: 'MEDIA_ERROR',
            attachmentId: currentAtt.attachmentId,
            objectId: currentAtt.objectId,
            error: err?.message,
          });
        }
      } finally {
        isFetchingRef.current = false;
      }
    },
    [activeSession, cloudClient, ensureCloudSession, key, displayUrl]
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

    if (!isNearViewport) return;

    if (attachment.objectId || attachment.attachmentId) {
      fetchAndDecrypt();
    } else if (!durableThumbnail) {
      setError('Attachment lacks objectId or attachmentId for cloud retrieval');
      setIsLoading(false);
    }
  }, [key, attachment.objectId, attachment.attachmentId, durableThumbnail, fetchAndDecrypt, isNearViewport]);

  // Handle broken/stale blob image or video load failure
  const handleMediaError = () => {
    if (!isMountedRef.current) return;
    setHasImgError(true);

    // Sent stickers are encrypted media objects. Their old preview blob is
    // process-local, so recover the authenticated attachment before trying
    // Telegram/CDN previews or the decorative fallback sticker.
    if (isSticker && (attachment.objectId || attachment.attachmentId)) {
      void fetchAndDecrypt(true);
      return;
    }

    if (isSticker) {
      const attemptStickerRecovery = async () => {
        try {
          const sourceUrl =
            attachment.previewUrl ||
            attachment.localPreviewUrl ||
            (attachment as any).url ||
            attachment.name;
          const blob = await telegramStickerService.fetchStickerBlob(sourceUrl, { allowSyntheticFallback: false });
          const blobUrl = URL.createObjectURL(blob);
          if (isMountedRef.current) {
            const recoveredStub: DecryptedMedia = {
              id: key,
              blobUrl,
              data: new Uint8Array(0),
              mimeType: attachment.mimeType || 'image/webp',
              name: attachment.name,
              sizeBytes: blob.size,
            };
            MediaCache.set(key, recoveredStub);
            if (attachment.name) MediaCache.set(attachment.name, recoveredStub);
            setMedia(recoveredStub);
            setHasImgError(false);
            setIsLoading(false);
          }
        } catch {
          if (isMountedRef.current) {
            setError('Sticker unavailable');
            setIsLoading(false);
          }
        }
      };
      void attemptStickerRecovery();
    } else {
      fetchAndDecrypt(true);
    }
  };

  const isVideoMedia = isVideo || attachment.mimeType?.startsWith('video/');
  const createdThumbUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Avoid eagerly extracting video thumbnails when an existing server/cached thumbnail exists
    if (!isVideoMedia || !displayUrl || durableThumbnail || attachment.thumbnailUrl) return;

    let isCancelled = false;
    let idleHandle: any = null;

    const generate = async () => {
      try {
        let blobSource: Blob | null = null;
        if (media?.data) {
          blobSource = new Blob([media.data as any], { type: attachment.mimeType || 'video/mp4' });
        } else {
          const res = await fetch(displayUrl);
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
    };

    // Defer expensive client-side video thumbnail generation to idle time
    if (typeof (window as any).requestIdleCallback === 'function') {
      idleHandle = (window as any).requestIdleCallback(() => {
        if (!isCancelled) void generate();
      }, { timeout: 2000 });
    } else {
      idleHandle = setTimeout(() => {
        if (!isCancelled) void generate();
      }, 120);
    }

    return () => {
      isCancelled = true;
      if (idleHandle !== null) {
        if (typeof (window as any).cancelIdleCallback === 'function') {
          try { (window as any).cancelIdleCallback(idleHandle); } catch (_e) {}
        } else {
          clearTimeout(idleHandle);
        }
      }
      if (createdThumbUrlRef.current && createdThumbUrlRef.current.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        try {
          URL.revokeObjectURL(createdThumbUrlRef.current);
        } catch (_e) {}
      }
    };
  }, [isVideoMedia, displayUrl, media, attachment.mimeType, durableThumbnail, attachment.thumbnailUrl]);

  if (isLoading && !displayUrl) {
    return (
      <div
        ref={viewportRef}
        className={`veil-media-thumbnail-loading ${className}`.trim()}
        role="progressbar"
        aria-label={`Decrypting ${attachment.name || 'media'}...`}
      >
        <div className="veil-media-skeleton-pulse" />
        <div className="veil-media-loading-badge">
          <span className="veil-spinner veil-spinner-sm" />
          <span>Decrypting</span>
        </div>
      </div>
    );
  }

    if (error && !displayUrl) {
    if (isSticker) {
      return (
        <div
          className={`veil-media-thumbnail-loading ${className}`.trim()}
          role="progressbar"
          aria-label="Loading sticker..."
        >
          <div className="veil-media-skeleton-pulse" />
        </div>
      );
    }
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
      ref={viewportRef}
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
      {displayUrl && !hasImgError ? (
        isVideoMedia ? (
          videoThumbnailUrl ? (
            <img
              src={videoThumbnailUrl}
              alt={isSticker ? '' : (alt || attachment.name)}
              className={`veil-media-thumbnail-img ${isShowingThumbnail ? 'veil-media-thumbnail-blurred' : ''}`.trim()}
              loading="lazy"
              onError={() => setVideoThumbnailUrl(null)}
            />
          ) : (
            <video
              src={displayUrl}
              className="veil-media-thumbnail-img veil-media-thumbnail-video"
              preload="metadata"
              muted
              playsInline
              onError={handleMediaError}
            />
          )
        ) : (
          <img
            src={displayUrl}
            alt={isSticker ? '' : (alt || attachment.name)}
            className={`veil-media-thumbnail-img ${isShowingThumbnail ? 'veil-media-thumbnail-blurred' : ''}`.trim()}
            loading="lazy"
            onLoad={() => setHasImgError(false)}
            onError={handleMediaError}
          />
        )
      ) : (
        <div className="veil-media-skeleton-pulse" />
      )}

      {isShowingThumbnail && !error && (
        <div
          className="veil-media-loading-badge"
          style={{ position: 'absolute', bottom: '6px', right: '6px', padding: '2px 6px', fontSize: '0.65rem' }}
        >
          <span className="veil-spinner veil-spinner-sm" style={{ width: '10px', height: '10px' }} />
        </div>
      )}

      {error && displayUrl && (
        <div
          className="veil-media-thumbnail-error"
          role="alert"
          style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(8, 12, 20, 0.72)', borderRadius: 'inherit', color: 'var(--veil-text-primary)' }}
        >
          <span style={{ fontSize: 'var(--veil-text-xs)', textAlign: 'center' }}>Media couldn’t load</span>
          <button
            type="button"
            className="veil-btn veil-btn-secondary veil-btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              void fetchAndDecrypt(true);
            }}
            style={{ padding: '0.25rem 0.6rem', gap: '4px' }}
          >
            <RefreshCwIcon size={14} />
            <span>Retry</span>
          </button>
        </div>
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

export const MediaImage = React.memo(MediaImageComponent);
