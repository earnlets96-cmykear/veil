import { SocialVideoLink, SocialVideoProvider } from './socialVideoLinks.ts';

export interface SocialVideoPreview {
  provider: SocialVideoProvider;
  canonicalUrl: string;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
}

const MAX_RESPONSE_BYTES = 64 * 1024;
const CACHE_LIMIT = 40;
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7000;
const previewCache = new Map<string, { value: SocialVideoPreview; expiresAt: number }>();
const inFlight = new Map<string, Promise<SocialVideoPreview | null>>();
const spaceGenerations = new Map<string, number>();

function cacheKey(spaceId: string, link: SocialVideoLink): string {
  return `${spaceId}\u0000${link.canonicalUrl}`;
}

function moveToNewest(key: string, entry: { value: SocialVideoPreview; expiresAt: number }): void {
  previewCache.delete(key);
  previewCache.set(key, entry);
}

function getCached(key: string): SocialVideoPreview | null {
  const entry = previewCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    previewCache.delete(key);
    return null;
  }
  moveToNewest(key, entry);
  return entry.value;
}

function isProviderThumbnail(provider: SocialVideoProvider, rawUrl: unknown): rawUrl is string {
  if (typeof rawUrl !== 'string' || rawUrl.length > 2048) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (provider === 'tiktok') {
      return ['tiktokcdn.com', 'tiktokcdn-us.com', 'muscdn.com'].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
    }
    return ['cdninstagram.com', 'fbcdn.net'].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return result ? result.slice(0, maxLength) : null;
}

function resolveTikTokShortLinkEmbedUrl(html: unknown): string | null {
  if (typeof html !== 'string' || html.length > MAX_RESPONSE_BYTES) return null;
  const videoId = html.match(/data-video-id\s*=\s*["'](\d{8,24})["']/i)?.[1] ||
    html.match(/\/video\/(\d{8,24})(?:[?"'\s/]|$)/i)?.[1];
  return videoId ? `https://www.tiktok.com/player/v1/${videoId}?autoplay=0` : null;
}

function providerRequestUrl(link: SocialVideoLink): string {
  const url = link.provider === 'tiktok'
    ? new URL('https://www.tiktok.com/oembed')
    : new URL('https://graph.facebook.com/v26.0/instagram_oembed');
  url.searchParams.set('url', link.canonicalUrl);
  if (link.provider === 'instagram') {
    url.searchParams.set('maxwidth', '480');
    url.searchParams.set('hidecaption', 'true');
  }
  return url.toString();
}

async function readBoundedPreview(response: Response): Promise<Record<string, unknown> | null> {
  if (!response.ok) return null;
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_RESPONSE_BYTES) return null;
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizePreview(link: SocialVideoLink, payload: Record<string, unknown>): SocialVideoPreview {
  const responseProvider = typeof payload.provider_name === 'string' ? payload.provider_name.toLowerCase() : '';
  const isExpectedProvider = link.provider === 'tiktok'
    ? responseProvider === 'tiktok'
    : responseProvider === 'instagram';

  return {
    provider: link.provider,
    canonicalUrl: link.canonicalUrl,
    title: safeText(payload.title, 200),
    author: safeText(payload.author_name, 80),
    thumbnailUrl: isExpectedProvider && isProviderThumbnail(link.provider, payload.thumbnail_url) ? payload.thumbnail_url : null,
    embedUrl: link.embedUrl || (link.provider === 'tiktok' ? resolveTikTokShortLinkEmbedUrl(payload.html) : null),
  };
}

async function requestPreview(link: SocialVideoLink): Promise<SocialVideoPreview | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(providerRequestUrl(link), {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const payload = await readBoundedPreview(response);
    if (!payload) return null;
    if (typeof payload.provider_name === 'string') {
      const providerName = payload.provider_name.toLowerCase();
      if ((link.provider === 'tiktok' && providerName !== 'tiktok') || (link.provider === 'instagram' && providerName !== 'instagram')) {
        return null;
      }
    }
    return normalizePreview(link, payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadSocialVideoPreview(
  link: SocialVideoLink,
  spaceId: string
): Promise<SocialVideoPreview | null> {
  if (!spaceId || (link.provider !== 'tiktok' && link.provider !== 'instagram')) return null;
  const key = cacheKey(spaceId, link);
  const cached = getCached(key);
  if (cached) return cached;
  const current = inFlight.get(key);
  if (current) return current;

  const generation = spaceGenerations.get(spaceId) || 0;
  const task = requestPreview(link).then((preview) => {
    if (preview && (spaceGenerations.get(spaceId) || 0) === generation) {
      previewCache.set(key, { value: preview, expiresAt: Date.now() + CACHE_TTL_MS });
      while (previewCache.size > CACHE_LIMIT) {
        const oldestKey = previewCache.keys().next().value;
        if (oldestKey === undefined) break;
        previewCache.delete(oldestKey);
      }
    }
    return preview;
  }).finally(() => {
    if (inFlight.get(key) === task) inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
}

export function clearSocialVideoPreviewCache(spaceId?: string): void {
  if (spaceId === undefined) {
    previewCache.clear();
    for (const id of spaceGenerations.keys()) spaceGenerations.set(id, (spaceGenerations.get(id) || 0) + 1);
    return;
  }
  spaceGenerations.set(spaceId, (spaceGenerations.get(spaceId) || 0) + 1);
  for (const key of previewCache.keys()) {
    if (key.startsWith(`${spaceId}\u0000`)) previewCache.delete(key);
  }
}
