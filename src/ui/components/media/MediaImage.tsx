/**
 * Inline Decrypted Media Image & Video Thumbnail Component for VEIL.
 *
 * Automatically orchestrates authenticated cloud retrieval, cryptographic reassembly,
 * and ephemeral Blob URL generation with loading skeleton and error recovery.
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../app/AppState.tsx';
import { MediaCache, DecryptedMedia, AttachmentPayload } from '../../utils/mediaCache.ts';
import { PlayIcon, ImageIcon, VideoIcon, RefreshCwIcon, AlertCircleIcon } from '../icons/index.ts';

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
  alt = 'Decrypted media',
  className = '',
  isVideo = false,
}) => {
  const { activeSession, cloudClient, ensureCloudSession } = useApp();
  const [media, setMedia] = useState<DecryptedMedia | null>(() => {
    const key = attachment.objectId || attachment.attachmentId || attachment.name;
    return MediaCache.get(key) || null;
  });
  const [isLoading, setIsLoading] = useState(!media);
  const [error, setError] = useState<string | null>(null);

  const fetchAndDecrypt = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    setError(null);

    try {
      if (!cloudClient.getSessionToken()) {
        await ensureCloudSession(activeSession);
      }

      const result = await MediaCache.getOrFetch(attachment, activeSession, cloudClient);
      setMedia(result);
    } catch (err: any) {
      setError(err.message || 'Failed to decrypt media');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const key = attachment.objectId || attachment.attachmentId || attachment.name;
    const cached = MediaCache.get(key);
    if (cached) {
      setMedia(cached);
      setIsLoading(false);
      return;
    }

    if (attachment.previewUrl && attachment.previewUrl.startsWith('blob:')) {
      const item: DecryptedMedia = {
        id: key,
        blobUrl: attachment.previewUrl,
        data: new Uint8Array(),
        mimeType: attachment.mimeType || 'image/jpeg',
        name: attachment.name,
        sizeBytes: attachment.sizeBytes || 0,
      };
      MediaCache.set(key, item);
      setMedia(item);
      setIsLoading(false);
      return;
    }

    fetchAndDecrypt();
  }, [attachment.objectId, attachment.attachmentId, attachment.previewUrl]);

  if (isLoading) {
    return (
      <div className={`veil-media-thumbnail-loading ${className}`.trim()} role="progressbar" aria-label="Decrypting media...">
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
        <AlertCircleIcon size={24} color="var(--veil-danger)" />
        <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
          {error || 'Decryption failed'}
        </span>
        <button
          type="button"
          className="veil-btn veil-btn-secondary veil-btn-sm"
          onClick={fetchAndDecrypt}
          style={{ marginTop: '0.4rem', padding: '0.2rem 0.5rem' }}
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
      aria-label={`View ${isVideo ? 'video' : 'image'} ${attachment.name}`}
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
      />

      {isVideo && (
        <div className="veil-media-play-badge" aria-hidden="true">
          <PlayIcon size={26} color="#ffffff" />
        </div>
      )}
    </div>
  );
};
