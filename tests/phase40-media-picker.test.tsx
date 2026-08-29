/**
 * Phase 40: In-App Media Picker & Multi-Select Bottom Sheet Test Suite.
 *
 * Verifies:
 * - MediaPickerModal rendering and structure
 * - Action buttons for Photos, Videos, Files, Camera
 * - Per-media privacy control toggles (allowSave, allowForward)
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaPickerModal } from '../src/ui/components/media/MediaPickerModal.tsx';

describe('Phase 40: In-App Media Picker & Multi-Select Bottom Sheet', () => {
  it('renders quick action buttons and privacy toggles', () => {
    const handleClose = vi.fn();
    const handleSend = vi.fn();

    const html = renderToStaticMarkup(
      <MediaPickerModal
        isOpen={true}
        onClose={handleClose}
        onSend={handleSend}
      />
    );

    expect(html).toContain('Attach Media &amp; Files');
    expect(html).toContain('Photos');
    expect(html).toContain('Videos');
    expect(html).toContain('Files');
    expect(html).toContain('Camera');
    expect(html).toContain('Per-Media Privacy Controls');
    expect(html).toContain('Allow recipient to save to gallery');
    expect(html).toContain('Allow forwarding');
  });

  it('renders closed state without crashing', () => {
    const html = renderToStaticMarkup(
      <MediaPickerModal
        isOpen={false}
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
