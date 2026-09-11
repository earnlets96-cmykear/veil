import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaPickerModal } from '../src/ui/components/media/MediaPickerModal.tsx';
import { NativeDeviceMediaBridge } from '../src/media/NativeDeviceMediaBridge.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 86: Share Media Bottom Sheet Redesign Suite (Real Device Media, Tabs, Theme)', () => {
  it('1. Renders bottom sheet with Share Media title, close button, and restructured source tabs', () => {
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

    // Source tab buttons in order: Gallery -> Camera -> Video -> Files
    expect(html).toContain('Gallery');
    expect(html).toContain('Camera');
    expect(html).toContain('Video');
    expect(html).toContain('Files');

    // 24h tab is completely removed
    expect(html).not.toContain('24h');

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

  it('2. Closed state renders cleanly without crashing', () => {
    const html = renderToStaticMarkup(
      <MediaPickerModal
        isOpen={false}
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('3. Does not contain synthetic mockup poster images or sampleMedia', () => {
    const html = renderToStaticMarkup(
      <MediaPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    // Verifies synthetic posters are eliminated
    expect(html).not.toContain('veil://sample/');
    expect(html).not.toContain('Blueprint Spec');
    expect(html).not.toContain('Conference Deck');
    expect(html).not.toContain('Workstation Rig');
    expect(html).not.toContain('Solar Villa');
    expect(html).not.toContain('Neon Skyline');
    expect(html).not.toContain('Filter Vessel');
  });

  it('4. NativeDeviceMediaBridge exposes captureMedia, pickDocuments, and supports file type', async () => {
    const captureMock = vi.fn(async () => ({
      items: [
        { uri: 'content://media/cam1', name: 'cam1.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 },
      ],
    }));
    const listMock = vi.fn(async () => ({
      items: [
        { uri: 'content://media/doc1', name: 'doc1.pdf', mimeType: 'application/pdf', sizeBytes: 4096 },
      ],
    }));

    const bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      captureMedia: captureMock,
      listRecentMedia: listMock,
    });

    // Test captureMedia
    const captured = await bridge.captureMedia();
    expect(captured).toHaveLength(1);
    expect(captured[0].name).toBe('cam1.jpg');
    expect(captureMock).toHaveBeenCalledTimes(1);

    // Test listRecentMedia with 'file'
    const docs = await bridge.listRecentMedia({ limit: 10, types: ['file'] });
    expect(docs.items).toHaveLength(1);
    expect(docs.items[0].name).toBe('doc1.pdf');
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ types: ['file'] }));
  });

  it('5. CSS geometry and dynamic theme token verification', () => {
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

    // Active theme tokens on selection borders & numbered badges
    expect(css).toContain('.veil-share-media-cell.selected');
    expect(css).toContain('border-color: var(--veil-accent-primary, #14b8a6) !important;');
    expect(css).toContain('.veil-media-badge-numbered');
    expect(css).toContain('background: var(--veil-accent-primary, #14b8a6) !important;');
    expect(css).toContain('color: var(--veil-text-on-accent, #ffffff) !important;');

    // Caption input box with theme focus
    expect(css).toContain('.veil-share-caption-box');
    expect(css).toContain('.veil-share-caption-input');
    expect(css).toContain('border-color: var(--veil-accent-primary, #14b8a6);');

    // Send pill button matches active theme
    expect(css).toContain('.veil-btn-share-send');
    expect(css).toContain('background: var(--veil-accent-primary, #14b8a6) !important;');
    expect(css).toContain('color: var(--veil-text-on-accent, #ffffff) !important;');

    // Permission and files styling
    expect(css).toContain('.veil-share-permission-card');
    expect(css).toContain('.veil-share-files-container');
    expect(css).toContain('.veil-share-file-row');
  });
});
