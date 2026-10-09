import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSocialVideoPreview, clearSocialVideoPreviewCache } from '../src/media/socialVideoPreviewService.ts';
import { parseSocialVideoUrl } from '../src/media/socialVideoLinks.ts';

describe('Phase 125 social video preview service', () => {
  beforeEach(() => {
    clearSocialVideoPreviewCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSocialVideoPreviewCache();
  });

  it('loads and validates TikTok metadata from the official oEmbed endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: '1.0',
      type: 'video',
      title: 'A public video',
      author_name: 'creator',
      thumbnail_url: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
      thumbnail_width: 720,
      thumbnail_height: 1280,
      provider_name: 'TikTok',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const link = parseSocialVideoUrl('https://www.tiktok.com/@creator/video/7351234567890123456')!;
    const preview = await loadSocialVideoPreview(link, 'space-a');

    expect(new URL(String(fetchMock.mock.calls[0][0])).origin).toBe('https://www.tiktok.com');
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/oembed');
    expect(preview).toMatchObject({
      provider: 'tiktok',
      title: 'A public video',
      author: 'creator',
      thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
      embedUrl: 'https://www.tiktok.com/player/v1/7351234567890123456?autoplay=0',
    });
  });

  it('resolves a TikTok short URL from the provider response without following the short link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: '1.0',
      type: 'video',
      title: 'Short link video',
      author_name: 'creator',
      thumbnail_url: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
      html: '<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@creator/video/7351234567890123456" data-video-id="7351234567890123456"></blockquote>',
      provider_name: 'TikTok',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const link = parseSocialVideoUrl('https://vm.tiktok.com/ZMxyz123/')!;
    const preview = await loadSocialVideoPreview(link, 'space-a');

    expect(preview?.embedUrl).toBe('https://www.tiktok.com/player/v1/7351234567890123456?autoplay=0');
    expect(String(fetchMock.mock.calls[0][0])).toContain('https%3A%2F%2Fvm.tiktok.com%2FZMxyz123%2F');
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/^https:\/\/vm\.tiktok\.com\//);
  });

  it('uses the official Meta oEmbed endpoint for Instagram and accepts missing thumbnail metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: '1.0',
      type: 'rich',
      provider_name: 'Instagram',
      html: '<blockquote class="instagram-media"></blockquote>',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;
    const preview = await loadSocialVideoPreview(link, 'space-a');

    expect(new URL(String(fetchMock.mock.calls[0][0])).origin).toBe('https://graph.facebook.com');
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/v26.0/instagram_oembed');
    expect(preview).toMatchObject({
      provider: 'instagram',
      thumbnailUrl: null,
      embedUrl: 'https://www.instagram.com/reel/C7abc_12/embed/',
    });
  });

  it('rejects thumbnail URLs from arbitrary hosts and keeps a usable player fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: '1.0',
      type: 'video',
      thumbnail_url: 'https://attacker.example/track.jpg',
      provider_name: 'TikTok',
    }), { status: 200 })));

    const link = parseSocialVideoUrl('https://www.tiktok.com/@creator/video/7351234567890123456')!;
    const preview = await loadSocialVideoPreview(link, 'space-a');

    expect(preview?.thumbnailUrl).toBeNull();
    expect(preview?.embedUrl).toBe(link.embedUrl);
  });

  it('rejects oversized or unsuccessful provider responses', async () => {
    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('too large', { status: 200, headers: { 'content-length': '70000' } }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 })));

    await expect(loadSocialVideoPreview(link, 'space-a')).resolves.toBeNull();
    await expect(loadSocialVideoPreview(link, 'space-a')).resolves.toBeNull();
  });

  it('coalesces duplicate in-flight requests and scopes cached metadata to the Space', async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;

    const first = loadSocialVideoPreview(link, 'space-a');
    const second = loadSocialVideoPreview(link, 'space-a');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse(new Response(JSON.stringify({ version: '1.0', type: 'rich', provider_name: 'Instagram' }), { status: 200 }));
    await Promise.all([first, second]);

    await loadSocialVideoPreview(link, 'space-a');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await loadSocialVideoPreview(link, 'space-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears cached previews for a locked Space', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ version: '1.0', type: 'rich' }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;

    await loadSocialVideoPreview(link, 'space-a');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await loadSocialVideoPreview(link, 'space-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    clearSocialVideoPreviewCache('space-a');
    await loadSocialVideoPreview(link, 'space-a');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await loadSocialVideoPreview(link, 'space-b');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
