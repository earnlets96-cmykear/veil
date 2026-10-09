import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SocialVideoLink } from '../../../media/socialVideoLinks.ts';
import { loadSocialVideoPreview, SocialVideoPreview } from '../../../media/socialVideoPreviewService.ts';
import { MaximizeIcon } from '../icons/index.ts';

const TIKTOK_PLAYER_READY_TIMEOUT_MS = 15_000;

interface SocialVideoPreviewCardProps {
  link: SocialVideoLink;
  spaceId: string;
}

interface SocialVideoEmbedProps {
  link: SocialVideoLink;
  src: string;
  title: string | null;
  onClose: () => void;
  onExpand: () => void;
  isFullscreen?: boolean;
}

export const SocialVideoEmbed: React.FC<SocialVideoEmbedProps> = ({
  link,
  src,
  title,
  onClose,
  onExpand,
  isFullscreen = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [playerError, setPlayerError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (link.provider !== 'tiktok') return;
    let playerReady = false;
    const readinessTimeout = window.setTimeout(() => {
      if (!playerReady) setPlayerError(true);
    }, TIKTOK_PLAYER_READY_TIMEOUT_MS);
    const handlePlayerMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.tiktok.com' || event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data['x-tiktok-player'] !== true) return;
      if (event.data.type === 'onPlayerReady') {
        playerReady = true;
        window.clearTimeout(readinessTimeout);
        return;
      }
      if (event.data.type === 'onPlayerError') {
        playerReady = true;
        window.clearTimeout(readinessTimeout);
        setPlayerError(true);
      }
    };
    window.addEventListener('message', handlePlayerMessage);
    return () => {
      window.clearTimeout(readinessTimeout);
      window.removeEventListener('message', handlePlayerMessage);
    };
  }, [link.provider, reloadKey]);

  const retryPlayer = () => {
    setPlayerError(false);
    setReloadKey((key) => key + 1);
  };

  return (
    <div className={`veil-social-video-player is-${link.provider}${isFullscreen ? ' is-fullscreen' : ''}`}>
      {playerError ? (
        <div className="veil-social-video-player-error" role="alert">
          <strong>Video unavailable in VEIL</strong>
          <span>The player did not finish loading or may be unavailable for this post.</span>
          <button type="button" onClick={retryPlayer}>Retry video</button>
        </div>
      ) : (
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={src}
          title={`${link.provider === 'tiktok' ? 'TikTok' : 'Instagram'} video player${title ? `: ${title}` : ''}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onError={() => setPlayerError(true)}
        />
      )}
      <div className="veil-social-video-player-actions">
        <a href={link.canonicalUrl} target="_blank" rel="noopener noreferrer">Open original</a>
        <button type="button" onClick={onExpand} aria-label={isFullscreen ? 'Exit full screen' : 'View full screen'}>
          <MaximizeIcon size={16} />
          <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
        </button>
        <button type="button" onClick={onClose} aria-label="Close video player">Close</button>
      </div>
    </div>
  );
};

export const SocialVideoPreviewCard: React.FC<SocialVideoPreviewCardProps> = ({ link, spaceId }) => {
  const previewRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const [isLoading, setIsLoading] = useState(Boolean(spaceId));
  const [preview, setPreview] = useState<SocialVideoPreview | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);
  const providerName = link.provider === 'tiktok' ? 'TikTok' : 'Instagram';

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadPreview = async (isActive: () => boolean) => {
    if (!spaceId) {
      if (isActive()) {
        setIsLoading(false);
        setFailed(true);
      }
      return;
    }

    setIsLoading(true);
    setFailed(false);
    try {
      const result = await loadSocialVideoPreview(link, spaceId);
      if (!isActive()) return;
      if (!result?.embedUrl) {
        if (link.embedUrl) {
          setPreview({
            provider: link.provider,
            canonicalUrl: link.canonicalUrl,
            title: null,
            author: null,
            thumbnailUrl: null,
            embedUrl: link.embedUrl,
          });
        } else {
          setFailed(true);
        }
        return;
      }
      setPreview(result);
    } catch {
      if (isActive()) setFailed(true);
    } finally {
      if (isActive()) setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | null = null;
    setPreview(null);
    setIsPlaying(false);
    setFailed(false);
    setIsLoading(Boolean(spaceId));
    const beginLoading = () => { void loadPreview(() => active); };
    const element = previewRef.current;

    if (!spaceId) {
      setIsLoading(false);
      setFailed(true);
    } else if (element && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        beginLoading();
      }, { rootMargin: '120px 0px' });
      observer.observe(element);
    } else {
      beginLoading();
    }

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [link.canonicalUrl, link.provider, spaceId]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const player = isPlaying && preview?.embedUrl ? (
    <SocialVideoEmbed
      link={link}
      src={preview.embedUrl}
      title={preview.title}
      onClose={() => { setIsPlaying(false); setIsFullscreen(false); }}
      onExpand={() => setIsFullscreen(true)}
      isFullscreen={isFullscreen}
    />
  ) : null;

  return (
    <>
      <section
        ref={previewRef}
        className={`veil-social-video-preview${player && !isFullscreen ? ' is-playing' : ''}`}
        aria-label={`${providerName} video preview`}
        aria-busy={isLoading}
        hidden={isFullscreen}
      >
        {player && !isFullscreen ? player : (
          <>
            {preview?.thumbnailUrl ? (
              <div className="veil-social-video-poster">
                <img
                  src={preview.thumbnailUrl}
                  alt={`${providerName} video${preview.author ? ` by ${preview.author}` : ''}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setPreview((current) => current ? { ...current, thumbnailUrl: null } : current)}
                />
                <button type="button" onClick={() => setIsPlaying(true)} aria-label={`Play ${providerName} video in VEIL`}>
                  Play in VEIL
                </button>
              </div>
            ) : isLoading ? (
              <div className="veil-social-video-poster veil-social-video-poster-loading" role="status" aria-label={`Loading ${providerName} preview`}>
                <span className="veil-social-video-preview-spinner" aria-hidden="true" />
                <span className="veil-social-video-preview-loading-label">Loading preview from {providerName}</span>
              </div>
            ) : (
              <div className="veil-social-video-poster veil-social-video-poster-fallback">
                {preview?.embedUrl && (
                  <button type="button" onClick={() => setIsPlaying(true)} aria-label={`Play ${providerName} video in VEIL`}>
                    Play in VEIL
                  </button>
                )}
              </div>
            )}
            <div className="veil-social-video-preview-copy">
              <strong>{preview?.title || `${providerName} video`}</strong>
              {preview?.author && <span>{preview.author}</span>}
              <span className="veil-social-video-preview-source">Preview from {providerName}</span>
              <a href={link.canonicalUrl} target="_blank" rel="noopener noreferrer">Open original</a>
              {failed && !isLoading && <button type="button" onClick={() => { void loadPreview(() => mountedRef.current); }}>Retry preview</button>}
            </div>
          </>
        )}
      </section>
      {isFullscreen && player && typeof document !== 'undefined' && createPortal(
        <div
          className="veil-social-video-fullscreen-overlay"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFullscreen(false); }}
        >
          <section
            className="veil-social-video-fullscreen-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${providerName} video full screen`}
          >
            {player}
          </section>
        </div>,
        document.body
      )}
    </>
  );
};
