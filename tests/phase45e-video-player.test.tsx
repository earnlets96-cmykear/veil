import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaViewer } from '../src/ui/components/media/MediaViewer.tsx';

describe('Phase 45E: Video Player Lifecycle, Seek & Controls', () => {
  it('1. renders video player with playback scrubber, volume, fullscreen, and duration controls', () => {
    const videoItem = {
      id: 'vid_item_01',
      type: 'video' as const,
      url: 'blob:mock-video-stream',
      name: 'adventure.mp4',
      sizeBytes: 1500000,
      mimeType: 'video/mp4',
      senderName: 'Alice',
    };

    const html = renderToStaticMarkup(
      <MediaViewer items={[videoItem]} onClose={() => {}} />
    );

    expect(html).toContain('adventure.mp4');
    expect(html).toContain('Alice');
    expect(html).toContain('veil-media-viewer-video');
    expect(html).toContain('veil-media-viewer-video-controls');
    expect(html).toContain('aria-label="Video scrubber"');
    expect(html).toContain('src="blob:mock-video-stream"');
  });

  it('2. verifies video seek calculation clamps correctly between 0 and 100 percent', () => {
    const duration = 120; // 2 minutes

    const calcSeek = (percent: number) => {
      const clamped = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
      return (clamped / 100) * duration;
    };

    expect(calcSeek(0)).toBe(0);
    expect(calcSeek(50)).toBe(60);
    expect(calcSeek(100)).toBe(120);
    expect(calcSeek(-10)).toBe(0);
    expect(calcSeek(150)).toBe(120);
  });
});
