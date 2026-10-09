import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SocialVideoPreviewCard, SocialVideoEmbed } from '../src/ui/components/ui/SocialVideoPreviewCard.tsx';
import { parseSocialVideoUrl } from '../src/media/socialVideoLinks.ts';

describe('Phase 126 social video preview UI', () => {
  it('does not contact providers or mount a thumbnail/player before the user loads the preview', () => {
    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;
    const html = renderToStaticMarkup(<SocialVideoPreviewCard link={link} spaceId="space-a" />);

    expect(html).toContain('Load video preview');
    expect(html).toContain('Instagram');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('graph.facebook.com');
  });

  it('renders only an isolated provider frame with autoplay disabled and a fallback link', () => {
    const link = parseSocialVideoUrl('https://www.tiktok.com/@creator/video/7351234567890123456')!;
    const html = renderToStaticMarkup(
      <SocialVideoEmbed
        link={link}
        src={link.embedUrl!}
        title="A public video"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('sandbox="allow-scripts allow-forms allow-presentation allow-popups"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain('allowFullScreen=""');
    expect(html).toContain('Open original');
    expect(html).not.toContain('allow="autoplay');
    expect(html).not.toContain('dangerouslySetInnerHTML');
  });

  it('falls back to a validated direct embed when the provider metadata endpoint is unavailable', () => {
    const component = readFileSync(`${process.cwd()}/src/ui/components/ui/SocialVideoPreviewCard.tsx`, 'utf8');
    expect(component).toContain('if (!result || !result.embedUrl)');
    expect(component).toContain('if (link.embedUrl)');
    expect(component).toContain('setIsPlaying(true)');
  });
});
