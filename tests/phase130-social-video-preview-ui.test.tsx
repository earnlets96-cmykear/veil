import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SocialVideoPreviewCard, SocialVideoEmbed } from '../src/ui/components/ui/SocialVideoPreviewCard.tsx';
import { parseSocialVideoUrl } from '../src/media/socialVideoLinks.ts';

const componentSource = readFileSync(`${process.cwd()}/src/ui/components/ui/SocialVideoPreviewCard.tsx`, 'utf8');
const messageSource = readFileSync(`${process.cwd()}/src/ui/components/ui/MessageBubble.tsx`, 'utf8');
const styles = readFileSync(`${process.cwd()}/src/styles/veil-components.css`, 'utf8');

describe('Phase 130 social video preview UX', () => {
  it('loads bounded metadata when the preview approaches the viewport and removes the extra load button', () => {
    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;
    const html = renderToStaticMarkup(<SocialVideoPreviewCard link={link} spaceId="space-a" />);

    expect(componentSource).toContain('loadSocialVideoPreview(link, spaceId)');
    expect(componentSource).toContain("{ rootMargin: '120px 0px' }");
    expect(componentSource).toContain('observer.observe(element)');
    expect(html).toContain('Instagram video preview');
    expect(html).toContain('Loading preview from Instagram');
    expect(html).not.toContain('Load video preview');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('Open original');
  });

  it('offers isolated user-started playback and optional full-screen viewing', () => {
    const link = parseSocialVideoUrl('https://www.tiktok.com/@creator/video/7351234567890123456')!;
    const html = renderToStaticMarkup(
      <SocialVideoEmbed
        link={link}
        src={link.embedUrl!}
        title="A public video"
        onClose={vi.fn()}
        onExpand={vi.fn()}
      />
    );

    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain('Open original');
    expect(html).toContain('View full screen');
    expect(html).not.toContain('allow="autoplay');
    expect(html).not.toContain('dangerouslySetInnerHTML');
    expect(componentSource).toContain("event.key === 'Escape'");
    expect(componentSource).toContain('aria-modal="true"');
  });

  it('replaces the preview card with one player and portals that player for full screen', () => {
    expect(componentSource).toContain("player && !isFullscreen ? player");
    expect(componentSource).toContain("className={`veil-social-video-preview${player && !isFullscreen ? ' is-playing' : ''}`}");
    expect(componentSource).toContain('createPortal(');
    expect(componentSource).toContain('document.body');
    expect(componentSource.match(/<SocialVideoEmbed\b/g)).toHaveLength(1);
    expect(componentSource).not.toContain('{!isFullscreen && player}');
  });

  it('checks TikTok errors against the provider origin and active iframe before showing recovery', () => {
    expect(componentSource).toContain("event.origin !== 'https://www.tiktok.com'");
    expect(componentSource).toContain('event.source !== iframeRef.current?.contentWindow');
    expect(componentSource).toContain("event.data.type === 'onPlayerError'");
    expect(componentSource).toContain("event.data.type === 'onPlayerReady'");
    expect(componentSource).toContain('Retry video');
    expect(componentSource).toContain('Open original');
  });

  it('constrains video bubbles to the inline player and gives Instagram more embed height', () => {
    expect(messageSource).toContain('veil-social-video-bubble');
    expect(styles).toMatch(/\.veil-social-video-bubble\s*\{[^}]*padding:\s*0\.35rem/s);
    expect(styles).toMatch(/\.veil-social-video-preview,[\s\S]*?width:\s*min\(100%, 320px\)/);
    expect(styles).toMatch(/\.veil-social-video-player\.is-instagram iframe\s*\{[^}]*min-height:\s*min\(440px, 72dvh\)/s);
    expect(styles).toContain('.veil-social-video-fullscreen-overlay');
  });
});
