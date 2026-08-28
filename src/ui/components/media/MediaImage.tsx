/**
 * Inline Decrypted Media Image & Video Thumbnail Component for VEIL.
 *
 * Automatically orchestrates authenticated cloud retrieval, cryptographic reassembly,
 * and ephemeral Blob URL generation with smooth loading skeleton and automatic dead-blob recovery.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../app/AppState.tsx';
import { MediaCache, DecryptedMedia, AttachmentPayload } from '../../utils/mediaCache.ts';
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
    return MediaCache.get(key) || null;
  });
  const [isLoading, setIsLoading] = useState(!media);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchAndDecrypt = useCallback(async (forceRetry = false) => {
    if (!activeSession) return;
    if (forceRetry) {
      MediaCache.invalidate(key);
    }

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      if (!cloudClient.getSessionToken()) {
        await ensureCloudSession(activeSession);
      }

      const result = await MediaCache.getOrFetch(attachment, activeSession, cloudClient);
      if (isMountedRef.current) {
        setMedia(result);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Media unavailable');
        setIsLoading(false);
      }
    }
  }, [activeSession, cloudClient, ensureCloudSession, key, attachment]);

  useEffect(() => {
    const cached = MediaCache.get(key);
    if (cached) {
      setMedia(cached);
      setIsLoading(false);
      return;
    }

    fetchAndDecrypt();
  }, [key, fetchAndDecrypt]);

  // Handle broken/stale blob image load failure
  const handleImageError = () => {
    if (isMountedRef.current) {
      MediaCache.invalidate(key);
      fetchAndDecrypt(true);
    }
  };

  if (isLoading) {
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

  if (error || !media) {
    return (
      <div className={`veil-media-thumbnail-error ${className}`.trim()} role="alert">
        <AlertCircleIcon size={22} color="var(--veil-danger)" />
        <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginTop: '2px' }}>
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
      aria-label={`View ${isVideo ? 'video' : 'photo'} ${attachment.name}`}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <img
        src={media.blobUrl}
        alt={alt || attachment.name}
        className="veil-media-thumbnail-img"
        loading="lazy"
        onError={handleImageError}
      />

      {isVideo && (
        <div className="veil-media-play-badge" aria-hidden="true">
          <PlayIcon size={26} color="#ffffff" />
        </div>
      )}
    </div>
  );
};
