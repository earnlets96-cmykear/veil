import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaPickerModal } from '../src/ui/components/media/MediaPickerModal.tsx';
import { SAMPLE_GALLERY_MEDIA, sampleMediaToFile } from '../src/ui/components/media/sampleMedia.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 86: Share Media Bottom Sheet Redesign Suite (Image 2 + Caption)', () => {
  it('1. Renders bottom sheet with Share Media title, close button, and source tabs', () => {
    const handleClose = vi.fn();
    const handleSend = vi.fn();

    const html = renderToStaticMarkup(
      <MediaPickerModal
        isOpen={true}
        onClose={handleClose}
        onSend={handleSend}
      />
    );

    // Title & Close Button
    expect(html).toContain('Share Media');
    expect(html).toContain('aria-label="Close dialog"');
    expect(html).toContain('veil-share-media-modal');

    // Source tab buttons
    expect(html).toContain('Gallery');
    expect(html).toContain('Camera');
    expect(html).toContain('Files');
    expect(html).toContain('24h');

    // Gallery tab starts active
    expect(html).toContain('veil-share-tab-btn active');

    // Backward-compatible screen reader texts for Phase 40
    expect(html).toContain('Attach Media &amp; Files');
    expect(html).toContain('Photos');
    expect(html).toContain('Videos');
    expect(html).toContain('Files');
    expect(html).toContain('Camera');
    expect(html).toContain('Recent');
    expect(html).toContain('Browse recent');
  });

  it('2. Directly displays 3-column media grid with curated sample gallery items', () => {
    const html = renderToStaticMarkup(
      <MediaPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    // Verifies 3-column grid container
    expect(html).toContain('veil-share-media-grid');

    // Verifies all 6 sample items are rendered in the cells
    SAMPLE_GALLERY_MEDIA.forEach((item) => {
      expect(html).toContain(`aria-label="Attach ${item.name}"`);
    });

    // Unselected indicators are rendered
    expect(html).toContain('veil-media-badge-unselected');

    // Initial footer state
    expect(html).toContain('Select media');
    expect(html).toContain('veil-btn-share-send');
    expect(html).toContain('disabled');
  });

  it('3. sampleMediaToFile produces valid File blobs for staging and Double Ratchet dispatch', () => {
    const item = SAMPLE_GALLERY_MEDIA[0];
    const file = sampleMediaToFile(item);

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe(item.name);
    expect(file.type).toBe(item.mimeType);
    expect(file.size).toBeGreaterThan(0);
  });

  it('4. Closed state renders cleanly without crashing', () => {
    const html = renderToStaticMarkup(
      <MediaPickerModal
        isOpen={false}
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('5. CSS geometry and token safety verification for Image 2 design', () => {
    const cssPath = path.resolve(__dirname, '../src/styles/veil-components.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Bottom sheet card styling
    expect(css).toContain('.veil-share-media-modal');
    expect(css).toContain('background: #18181b');
    expect(css).toContain('border-radius: 28px');

    // Top drag handle pseudo-element
    expect(css).toContain('.veil-share-media-modal .veil-modal-header::before');

    // Circular close button styling
    expect(css).toContain('.veil-share-media-modal .veil-modal-header button');

    // White active Gallery pill
    expect(css).toContain('.veil-share-tab-btn.active');
    expect(css).toContain('background: #ffffff');
    expect(css).toContain('color: #111827');

    // 3-column media grid
    expect(css).toContain('.veil-share-media-grid');
    expect(css).toContain('grid-template-columns: repeat(3, 1fr)');

    // Purple selection borders & numbered badges (#a78bfa)
    expect(css).toContain('.veil-share-media-cell.selected');
    expect(css).toContain('#a78bfa');
    expect(css).toContain('.veil-media-badge-numbered');

    // Caption input box
    expect(css).toContain('.veil-share-caption-box');
    expect(css).toContain('.veil-share-caption-input');

    // Send pill button
    expect(css).toContain('.veil-btn-share-send');
  });
});
