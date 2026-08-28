/**
 * Phase 37 — Mobile Layout & Message Bubble Geometry Test Suite
 *
 * Verifies:
 * 1. Global root viewport constraints prevent horizontal sideways scrolling.
 * 2. Message bubble max-width and min-width geometric bounds.
 * 3. Media card max-width and min-width geometry.
 * 4. Message meta timestamp nowrap enforcement to prevent vertical character wrapping.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 37 — Mobile Layout Geometry Verification', () => {
  const cssPath = path.resolve(__dirname, '../src/styles/veil-design-system.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('4.1: Root viewport invariants prevent horizontal scrolling', () => {
    expect(cssContent).toContain('overflow-x: hidden');
    expect(cssContent).toContain('box-sizing: border-box');
  });

  it('4.2: Mobile message bubble width bounds are strictly defined', () => {
    expect(cssContent).toContain('min-width: 60px');
    expect(cssContent).toContain('word-break: break-word');
    expect(cssContent).toContain('max-width: min(78vw, 420px)');
  });

  it('4.3: Media bubble container enforces responsive max/min bounds', () => {
    expect(cssContent).toContain('.veil-media-bubble-container');
    expect(cssContent).toContain('max-width: min(82vw, 360px)');
    expect(cssContent).toContain('min-width: 160px');
  });

  it('4.4: Timestamp and status metadata prevent vertical character wrapping', () => {
    expect(cssContent).toContain('white-space: nowrap');
    expect(cssContent).toContain('.veil-message-meta');
  });
});
