import React, { useState } from 'react';
import { SocialVideoLink } from '../../../media/socialVideoLinks.ts';
import { loadSocialVideoPreview, SocialVideoPreview } from '../../../media/socialVideoPreviewService.ts';

interface SocialVideoPreviewCardProps {
  link: SocialVideoLink;
  spaceId: string;
}

interface SocialVideoEmbedProps {
  link: SocialVideoLink;
  src: string;
  title: string | null;
  onClose: () => void;
}

export const SocialVideoEmbed: React.FC<SocialVideoEmbedProps> = ({ link, src, title, onClose }) => (
  <div className="veil-social-video-player">
    <iframe
      src={src}
      title={`${link.provider === 'tiktok' ? 'TikTok' : 'Instagram'} video player${title ? `: ${title}` : ''}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-presentation allow-popups"
      allow="encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
    <div className="veil-social-video-player-actions">
      <a href={link.canonicalUrl} target="_blank" rel="noopener noreferrer">Open original</a>
      <button type="button" onClick={onClose} aria-label="Close video player">Close</button>
    </div>
  </div>
);

export const SocialVideoPreviewCard: React.FC<SocialVideoPreviewCardProps> = ({ link, spaceId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<SocialVideoPreview | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const providerName = link.provider === 'tiktok' ? 'TikTok' : 'Instagram';

  const handleLoadPreview = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setFailed(false);
    try {
      const result = await loadSocialVideoPreview(link, spaceId);
      if (!result || !result.embedUrl) {
        if (link.embedUrl) {
          setPreview({
            provider: link.provider,
            canonicalUrl: link.canonicalUrl,
            title: null,
            author: null,
            thumbnailUrl: null,
            embedUrl: link.embedUrl,
          });
          setIsPlaying(true);
          return;
        }
        setFailed(true);
        return;
      }
      setPreview(result);
      setIsPlaying(!result.thumbnailUrl);
    } finally {
      setIsLoading(false);
    }
  };

  if (isPlaying && preview?.embedUrl) {
    return (
      <SocialVideoEmbed
        link={link}
        src={preview.embedUrl}
        title={preview.title}
        onClose={() => setIsPlaying(false)}
      />
    );
  }

  return (
    <section className="veil-social-video-preview" aria-label={`${providerName} video preview`}>
      {preview?.thumbnailUrl ? (
        <div className="veil-social-video-poster">
          <img
            src={preview.thumbnailUrl}
            alt={`${providerName} video${preview.author ? ` by ${preview.author}` : ''}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          <button type="button" onClick={() => setIsPlaying(true)} aria-label={`Play ${providerName} video in VEIL`}>
            Play in VEIL
          </button>
        </div>
      ) : null}
      <div className="veil-social-video-preview-copy">
        <strong>{preview?.title || `${providerName} video`}</strong>
        {preview?.author && <span>{preview.author}</span>}
        <a href={link.canonicalUrl} target="_blank" rel="noopener noreferrer">Open original</a>
      </div>
      {!preview && (
        <div className="veil-social-video-load">
          <button type="button" onClick={handleLoadPreview} disabled={isLoading || !spaceId}>
            {isLoading ? 'Loading preview…' : failed ? 'Try preview again' : 'Load video preview'}
          </button>
          <span>Loads from {providerName} only after you request it.</span>
        </div>
      )}
    </section>
  );
};
