/**
 * Phase 37 Android Layout Regression Tests.
 *
 * Validates the CSS architecture that prevents Android WebView message bubble collapse,
 * viewport configuration, media container geometry, and mobile responsive rules.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 37 — Android Layout & Viewport Configuration', () => {
  it('index.html viewport meta tag includes viewport-fit=cover and user-scalable=no', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
    expect(indexHtml).toContain('viewport-fit=cover');
    expect(indexHtml).toContain('maximum-scale=1.0');
    expect(indexHtml).toContain('user-scalable=no');
    expect(indexHtml).toContain('width=device-width');
    expect(indexHtml).toContain('initial-scale=1.0');
  });

  it('veil-message-row does NOT use width:100% (causes shrink-wrap collapse in WebView)', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    // Extract the .veil-message-row rule block
    const msgRowMatch = css.match(/\.veil-message-row\s*\{[^}]*\}/);
    expect(msgRowMatch).toBeTruthy();
    const msgRowBlock = msgRowMatch![0];
    // Must NOT have width: 100% (only max-width: 100%)
    expect(msgRowBlock).not.toMatch(/(?<![a-zA-Z-])width\s*:\s*100%/);
    // Should have max-width: 100% instead
    expect(msgRowBlock).toMatch(/max-width\s*:\s*100%/);
  });

  it('veil-bubble-wrapper uses width:fit-content and sensible max-width', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    const wrapperMatch = css.match(/\.veil-bubble-wrapper\s*\{[^}]*\}/);
    expect(wrapperMatch).toBeTruthy();
    const block = wrapperMatch![0];
    expect(block).toMatch(/width\s*:\s*fit-content/);
    expect(block).toMatch(/max-width\s*:/);
    expect(block).toMatch(/min-width\s*:\s*0/);
  });

  it('veil-message-bubble uses width:fit-content and word-break:break-word', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    const bubbleMatch = css.match(/\.veil-message-bubble\s*\{[^}]*\}/);
    expect(bubbleMatch).toBeTruthy();
    const block = bubbleMatch![0];
    expect(block).toMatch(/width\s*:\s*fit-content/);
    expect(block).toMatch(/word-break\s*:\s*break-word/);
    expect(block).toMatch(/display\s*:\s*inline-block/);
  });

  it('veil-message-meta uses float:right and white-space:nowrap for horizontal timestamps', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    const metaMatch = css.match(/\.veil-message-meta\s*\{[^}]*\}/);
    expect(metaMatch).toBeTruthy();
    const block = metaMatch![0];
    expect(block).toMatch(/white-space\s*:\s*nowrap/);
    expect(block).toMatch(/float\s*:\s*right/);
    expect(block).toMatch(/display\s*:\s*inline-flex/);
  });

  it('veil-media-bubble-container uses explicit width (not width:100%) to prevent collapse', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');
    const mediaMatch = css.match(/\.veil-media-bubble-container\s*\{[^}]*\}/);
    expect(mediaMatch).toBeTruthy();
    const block = mediaMatch![0];
    // Must have an explicit width like min(80vw, 360px)
    expect(block).toMatch(/width\s*:\s*min\(/);
    expect(block).toMatch(/min-width\s*:\s*180px/);
    // Must NOT have width: 100% as the primary width (would collapse in shrink-wrap flex)
    const widthDeclarations = block.match(/^\s*width\s*:/gm);
    if (widthDeclarations) {
      const primaryWidth = widthDeclarations[0];
      expect(primaryWidth).not.toMatch(/100%/);
    }
  });

  it('mobile responsive rules set conversation to fixed full-viewport when has-active-chat', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    // Check that .has-active-chat .veil-conversation gets position:fixed and width:100vw
    expect(css).toContain('.veil-app-layout.has-active-chat .veil-conversation');
    expect(css).toMatch(/\.veil-app-layout\.has-active-chat\s+\.veil-conversation\s*\{[^}]*width\s*:\s*100vw/s);
    expect(css).toMatch(/\.veil-app-layout\.has-active-chat\s+\.veil-conversation\s*\{[^}]*position\s*:\s*fixed/s);
  });

  it('mobile responsive rules hide sidebar when has-active-chat', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    expect(css).toMatch(/\.veil-app-layout\.has-active-chat\s+\.veil-sidebar\s*\{[^}]*display\s*:\s*none/s);
  });

  it('mobile responsive rules hide empty state on mobile', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    expect(css).toContain('.veil-app-layout:not(.has-active-chat) .veil-conversation-empty');
  });
});
