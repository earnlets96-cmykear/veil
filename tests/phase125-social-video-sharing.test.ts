import { describe, expect, it } from 'vitest';
import {
  extractSocialVideoLink,
  parseSocialVideoUrl,
  splitSocialVideoLinkText,
} from '../src/media/socialVideoLinks.ts';

describe('Phase 125 social video links', () => {
  it('recognizes a TikTok video and builds its non-autoplay player URL', () => {
    const result = parseSocialVideoUrl('https://www.tiktok.com/@creator/video/7351234567890123456?is_from_webapp=1');

    expect(result).toEqual({
      provider: 'tiktok',
      canonicalUrl: 'https://www.tiktok.com/@creator/video/7351234567890123456',
      embedUrl: 'https://www.tiktok.com/player/v1/7351234567890123456?autoplay=0',
    });
  });

  it('recognizes public Instagram reel and post URLs and removes tracking parameters', () => {
    expect(parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/?igsh=tracking')).toEqual({
      provider: 'instagram',
      canonicalUrl: 'https://www.instagram.com/reel/C7abc_12/',
      embedUrl: 'https://www.instagram.com/reel/C7abc_12/embed/',
    });

    expect(parseSocialVideoUrl('https://instagram.com/p/AbC987_x/')).toEqual({
      provider: 'instagram',
      canonicalUrl: 'https://www.instagram.com/p/AbC987_x/',
      embedUrl: 'https://www.instagram.com/p/AbC987_x/embed/',
    });
  });

  it('accepts TikTok short links for official metadata resolution without following redirects', () => {
    expect(parseSocialVideoUrl('https://vm.tiktok.com/ZMxyz123/')).toEqual({
      provider: 'tiktok',
      canonicalUrl: 'https://vm.tiktok.com/ZMxyz123/',
      embedUrl: null,
    });
  });

  it('accepts TikTok /t/ and Instagram share/Reel links for provider-side resolution', () => {
    expect(parseSocialVideoUrl('https://www.tiktok.com/t/ZP8abc123/')).toMatchObject({
      provider: 'tiktok',
      canonicalUrl: 'https://www.tiktok.com/t/ZP8abc123/',
      embedUrl: null,
    });
    expect(parseSocialVideoUrl('https://www.instagram.com/share/reel/C7abc_12/')).toMatchObject({
      provider: 'instagram',
      canonicalUrl: 'https://www.instagram.com/reel/C7abc_12/',
      embedUrl: 'https://www.instagram.com/reel/C7abc_12/embed/',
    });
  });

  it('extracts a supported video URL from shared text and strips surrounding punctuation', () => {
    expect(extractSocialVideoLink('Check this out: https://www.instagram.com/reel/C7abc_12/?igsh=abc.'))
      .toEqual(parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/'));
  });

  it('separates the video URL from surrounding message text for a non-duplicated card', () => {
    expect(splitSocialVideoLinkText('Look at this https://www.tiktok.com/@creator/video/7351234567890123456?share=1'))
      .toEqual({
        link: parseSocialVideoUrl('https://www.tiktok.com/@creator/video/7351234567890123456'),
        text: 'Look at this',
      });
  });

  it.each([
    'http://www.tiktok.com/@creator/video/7351234567890123456',
    'https://www.tiktok.com.attacker.example/@creator/video/7351234567890123456',
    'https://www.instagram.com.attacker.example/reel/C7abc_12/',
    'javascript:alert(1)',
    'https://www.instagram.com:443@attacker.example/reel/C7abc_12/',
    'https://www.instagram.com/accounts/login/',
  ])('rejects unsupported, unsafe, or non-video URL %s', (url) => {
    expect(parseSocialVideoUrl(url)).toBeNull();
  });
});
