export type SocialVideoProvider = 'instagram' | 'tiktok';

export interface SocialVideoLink {
  provider: SocialVideoProvider;
  canonicalUrl: string;
  embedUrl: string | null;
}

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);
const INSTAGRAM_POST_PATH = /^\/(reel|p|tv)\/([A-Za-z0-9_-]{5,32})\/?$/i;
const INSTAGRAM_SHARE_PATH = /^\/share\/reel\/([A-Za-z0-9_-]{5,32})\/?$/i;
const TIKTOK_VIDEO_PATH = /^\/@[A-Za-z0-9._-]{1,64}\/video\/(\d{8,24})\/?$/i;
const TIKTOK_SHORT_PATH = /^\/[A-Za-z0-9_-]{4,64}\/?$/;

function normalizeHttpUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

export function parseSocialVideoUrl(rawUrl: string): SocialVideoLink | null {
  const url = normalizeHttpUrl(rawUrl);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  if (INSTAGRAM_HOSTS.has(host)) {
    const match = url.pathname.match(INSTAGRAM_POST_PATH);
    const shareMatch = url.pathname.match(INSTAGRAM_SHARE_PATH);
    if (shareMatch) {
      const shortcode = shareMatch[1];
      const path = `/reel/${shortcode}/`;
      return {
        provider: 'instagram',
        canonicalUrl: `https://www.instagram.com${path}`,
        embedUrl: `https://www.instagram.com${path}embed/`,
      };
    }
    if (!match) return null;
    const [, type, shortcode] = match;
    const path = `/${type.toLowerCase()}/${shortcode}/`;
    return {
      provider: 'instagram',
      canonicalUrl: `https://www.instagram.com${path}`,
      embedUrl: `https://www.instagram.com${path}embed/`,
    };
  }

  if (TIKTOK_HOSTS.has(host)) {
    const videoMatch = url.pathname.match(TIKTOK_VIDEO_PATH);
    if (videoMatch) {
      const videoId = videoMatch[1];
      const path = url.pathname.replace(/\/$/, '');
      return {
        provider: 'tiktok',
        canonicalUrl: `https://www.tiktok.com${path}`,
        embedUrl: `https://www.tiktok.com/player/v1/${videoId}?autoplay=0`,
      };
    }

    if ((host === 'vm.tiktok.com' || host === 'vt.tiktok.com') && TIKTOK_SHORT_PATH.test(url.pathname)) {
      return {
        provider: 'tiktok',
        canonicalUrl: `https://${host}${url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`}`,
        embedUrl: null,
      };
    }

    if (host === 'www.tiktok.com' && /^\/t\/[A-Za-z0-9_-]{4,64}\/?$/.test(url.pathname)) {
      return {
        provider: 'tiktok',
        canonicalUrl: `https://www.tiktok.com${url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`}`,
        embedUrl: null,
      };
    }
  }

  return null;
}

export function extractSocialVideoLink(text: string): SocialVideoLink | null {
  return splitSocialVideoLinkText(text)?.link || null;
}

export function splitSocialVideoLinkText(text: string): { link: SocialVideoLink; text: string } | null {
  const urlPattern = /https:\/\/[^\s<>"'`]+/gi;
  for (const match of text.matchAll(urlPattern)) {
    const candidate = match[0];
    const cleaned = candidate.replace(/[),.;!?\]}]+$/g, '');
    const link = parseSocialVideoUrl(cleaned);
    if (!link || match.index === undefined) continue;
    const remainder = `${text.slice(0, match.index)}${text.slice(match.index + candidate.length)}`
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { link, text: remainder };
  }
  return null;
}
