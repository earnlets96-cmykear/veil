import React, { useCallback, useEffect, useRef, useState } from 'react';
import { telegramStickerService } from '../../../media/telegramStickerService.ts';
import { ImageIcon } from '../icons/index.ts';

type ImageStatus = 'loading' | 'loaded' | 'error';

export interface StickerImageProps {
  url: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  loading?: 'eager' | 'lazy';
}

/** Loads a sticker directly first, then retries once through VEIL's sticker proxy. */
export const StickerImage: React.FC<StickerImageProps> = ({
  url,
  alt = 'Sticker',
  className = '',
  imageClassName = '',
  loading = 'lazy',
}) => {
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<ImageStatus>(url ? 'loading' : 'error');
  const proxyAttemptedRef = useRef(false);
  const requestIdRef = useRef(0);
  const activeBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    proxyAttemptedRef.current = false;
    setSource(url.startsWith('data:') || url.startsWith('blob:') ? url : '');
    setStatus(url ? 'loading' : 'error');
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    let cancelled = false;
    if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
      void telegramStickerService.getCachedStickerBlob(url).then((cached) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        if (cached) {
          const blobUrl = URL.createObjectURL(cached);
          activeBlobUrlRef.current = blobUrl;
          setSource(blobUrl);
        } else {
          setSource(url);
        }
      }).catch(() => {
        if (!cancelled && requestId === requestIdRef.current) setSource(url);
      });
    }

    return () => {
      cancelled = true;
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [url]);

  const handleError = useCallback(async () => {
    if (proxyAttemptedRef.current) {
      setStatus('error');
      return;
    }

    proxyAttemptedRef.current = true;
    const requestId = requestIdRef.current;
    try {
      const blob = await telegramStickerService.fetchStickerBlob(url, { allowSyntheticFallback: false });
      if (requestId !== requestIdRef.current) return;
      const blobUrl = URL.createObjectURL(blob);
      if (activeBlobUrlRef.current) URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = blobUrl;
      setSource(blobUrl);
      setStatus('loading');
    } catch {
      if (requestId === requestIdRef.current) setStatus('error');
    }
  }, [url]);

  return (
    <span className={`veil-sticker-image ${className}`.trim()} data-load-state={status}>
      {status === 'loading' && <span className="veil-sticker-skeleton" aria-hidden="true" />}
      {status === 'error' ? (
        <span className="veil-sticker-image-unavailable" role="img" aria-label={`${alt} unavailable`}>
          <ImageIcon size={20} />
        </span>
      ) : source ? (
        <img
          key={source}
          src={source}
          alt={alt}
          loading={loading}
          decoding="async"
          className={imageClassName}
          onLoad={() => setStatus('loaded')}
          onError={() => void handleError()}
        />
      ) : null}
    </span>
  );
};
