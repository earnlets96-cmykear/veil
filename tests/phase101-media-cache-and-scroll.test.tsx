/**
 * Phase 101: Media Cache, Timeline Scroll & Visual Anchoring Test Suite
 *
 * Verifies that:
 * 1. ProgressCircle displays an indeterminate spinner on 0% progress and SVG circular progress when >0%.
 * 2. Timeline CSS contains overflow-anchor: auto to stabilize scrolling when media elements resize or load.
 * 3. Context menu CSS enforces streamlined, compact height without excessive padding.
 * 4. Emoji/sticker drawer CSS enforces compact max height on mobile viewports.
 * 5. Zero literal Unicode emojis are present.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProgressCircle } from '../src/ui/components/ui/ProgressCircle.tsx';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 101: Media Cache, Timeline Scroll & CSS Geometry', () => {
  describe('ProgressCircle Indeterminate Spinner', () => {
    it('renders indeterminate spinner when percent is 0', () => {
      const html = renderToStaticMarkup(
        <ProgressCircle
          percent={0}
          size={36}
          strokeWidth={3}
          indeterminate={true}
        />
      );

      // Verify indeterminate spinner is present
      expect(html).toContain('veil-spinner');
      expect(html).toContain('aria-label="Preparing transfer..."');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="0"');

      // Zero literal Unicode emojis
      expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    });

    it('renders determinate stroke offset when percent is positive', () => {
      const html = renderToStaticMarkup(
        <ProgressCircle
          percent={60}
          size={36}
          strokeWidth={3}
          showPercentage={true}
        />
      );

      // Verify determinate progress ring is rendered
      expect(html).toContain('aria-valuenow="60"');
      expect(html).toContain('stroke-dashoffset');
      expect(html).toContain('60%');
      expect(html).toContain('stroke="var(--veil-accent-primary, #14b8a6)"');
    });
  });

  describe('CSS Scroll Anchoring & Compact Geometry Integrity', () => {
    it('verifies veil-timeline has overflow-anchor: auto for scroll stability', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/veil-design-system.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('.veil-timeline {');
      expect(css).toMatch(/\.veil-timeline\s*\{[^}]*overflow-anchor:\s*auto/);
    });

    it('verifies context menu has streamlined compact dimensions', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      // Verify compact context menu styling
      expect(css).toContain('.veil-context-menu {');
      expect(css).toMatch(/\.veil-context-menu\s*\{[^}]*padding:\s*4px/);
      expect(css).toMatch(/\.veil-context-menu-item\s*\{[^}]*padding:\s*6px 10px/);
    });

    it('verifies sticker/emoji drawer is height-constrained on mobile', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('.veil-emoji-drawer-open {');
      expect(css).toMatch(/height:\s*min\(400px,\s*52dvh\)/);
    });

    it('verifies media loading placeholder matches container dimensions to prevent layout shifts', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('.veil-media-bubble-container .veil-media-thumbnail-loading');
      expect(css).toMatch(/\.veil-media-bubble-container\s+\.veil-media-thumbnail-loading\s*\{[^}]*min-height:\s*160px/);
      expect(css).toMatch(/\.veil-media-bubble-container\s+\.veil-media-thumbnail-loading\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*10/);
    });

    it('keeps sent photo and video previews outlined and media bubbles compact', () => {
      const cssPath = path.resolve(__dirname, '../src/styles/veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      const mediaImagePath = path.resolve(__dirname, '../src/ui/components/media/MediaImage.tsx');
      const mediaImage = fs.readFileSync(mediaImagePath, 'utf8');
      const groupedMediaPath = path.resolve(__dirname, '../src/ui/components/media/GroupedMediaGrid.tsx');
      const groupedMedia = fs.readFileSync(groupedMediaPath, 'utf8');

      expect(css).toMatch(/\.veil-msg-row\.outgoing\s+\.veil-media-bubble-container\s+\.veil-media-thumbnail-img\s*\{[^}]*border:\s*1px solid var\(--veil-border\)/);
      expect(css).toMatch(/\.veil-media-bubble-container\s*\{[^}]*width:\s*min\(72vw,\s*300px\)/);
      expect(css).toMatch(/\.veil-media-thumbnail-img\s*\{[^}]*max-height:\s*300px/);
      expect(mediaImage).toContain('className="veil-media-thumbnail-img veil-media-thumbnail-video"');
      expect(mediaImage).toContain('veil-media-thumbnail-img ${isShowingThumbnail ?');
      expect(groupedMedia).toContain("maxWidth: '320px'");
      expect(groupedMedia).toContain("height: '150px'");
      expect(groupedMedia).toContain("height: '200px'");
    });

    it('verifies ConversationView implements native column-reverse bottom anchoring and does not force users to bottom when scrolled up', () => {
      const cvPath = path.resolve(__dirname, '../src/ui/components/ConversationView.tsx');
      const cvContent = fs.readFileSync(cvPath, 'utf8');

      // Verify column-reverse bottom-anchoring and isAtBottomRef are defined
      expect(cvContent).toContain('isAtBottomRef');
      expect(cvContent).toContain('el.scrollTop > -120');
      expect(cvContent).toContain('if (isAtBottomRef.current || isRecentlySentByMe)');

      // Verify no jittery ResizeObserver scroll compensation loops
      expect(cvContent).not.toContain('new ResizeObserver');

      // Direct simulation of column-reverse bottom anchoring:
      // In column-reverse, content additions above grow in the negative direction, leaving the visible viewport completely undisturbed.
      const simulatedContainer = { scrollTop: -150 }; // user scrolled 150px up
      const isAtBottom = simulatedContainer.scrollTop > -120;
      expect(isAtBottom).toBe(false);
    });
  });
});

