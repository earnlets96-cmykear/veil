import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SocialVideoPreviewCard, SocialVideoEmbed } from '../src/ui/components/ui/SocialVideoPreviewCard.tsx';
import { parseSocialVideoUrl } from '../src/media/socialVideoLinks.ts';

describe('Social video preview UI', () => {
  it('shows an in-view loading preview without an extra load button or eager player', () => {
    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;
    const html = renderToStaticMarkup(<SocialVideoPreviewCard link={link} spaceId="space-a" />);

    expect(html).toContain('Instagram video preview');
    expect(html).toContain('Loading preview from Instagram');
    expect(html).not.toContain('Load video preview');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('Open original');
  });

  it('renders an isolated provider frame with playback controls and a full-screen action', () => {
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
    expect(html).toContain('allowFullScreen=""');
    expect(html).toContain('Open original');
    expect(html).toContain('View full screen');
    expect(html).not.toContain('allow="autoplay');
    expect(html).not.toContain('dangerouslySetInnerHTML');
  });

  it('retains the validated direct embed fallback when provider metadata is unavailable', () => {
    const component = readFileSync(`${process.cwd()}/src/ui/components/ui/SocialVideoPreviewCard.tsx`, 'utf8');
    expect(component).toContain('if (!result?.embedUrl)');
    expect(component).toContain('if (link.embedUrl)');
    expect(component).toContain('embedUrl: link.embedUrl');
  });
});
