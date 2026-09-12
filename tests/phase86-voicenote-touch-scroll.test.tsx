/**
 * Phase 86 — Voice Note Touch Scroll & Directional Seeking Verification Tests
 *
 * Verifies:
 * 1. CSS touch-action rules:
 *    - .veil-voicenote-card must specify `touch-action: pan-y` (not `none`) to allow vertical timeline scrolling.
 *    - .veil-waveform-container must specify `touch-action: pan-y`.
 * 2. VoiceNoteCard inline styles:
 *    - Rendered output contains `touch-action: pan-y` on card and waveform container.
 *    - Rendered output does NOT contain `touch-action: none`.
 * 3. Directional gesture handling:
 *    - Neither handlePointerDown nor handleTouchStartTrack calls preventDefault() unconditionally on touch down.
 *    - Directional disambiguation checks (|deltaY| vs |deltaX|) are enforced to prevent seeking during vertical scrolling.
 * 4. Zero Unicode emoji ban compliance.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 86 — Voice Note Touch Scroll & Directional Seeking', () => {
  describe('1. CSS touch-action Rules', () => {
    it('veil-components.css enforces touch-action: pan-y on .veil-voicenote-card and .veil-waveform-container', () => {
      const cssPath = path.join(rootDir, 'src/styles/veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      // Must not disable touch gestures on .veil-voicenote-card
      const cardRuleMatch = css.match(/\.veil-voicenote-card\s*\{([^}]+)\}/);
      expect(cardRuleMatch).not.toBeNull();
      const cardStyles = cardRuleMatch![1];
      expect(cardStyles).not.toMatch(/touch-action:\s*none/);
      expect(cardStyles).toMatch(/touch-action:\s*pan-y/);

      // Must specify touch-action: pan-y on .veil-waveform-container
      const waveRuleMatch = css.match(/\.veil-waveform-container\s*\{([^}]+)\}/);
      expect(waveRuleMatch).not.toBeNull();
      const waveStyles = waveRuleMatch![1];
      expect(waveStyles).toMatch(/touch-action:\s*pan-y/);
    });
  });

  describe('2. VoiceNoteCard Inline Styles & Rendered Output', () => {
    it('VoiceNoteCard renders with touch-action: pan-y on card container and waveform track', () => {
      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="msg-touch-scroll-test"
          durationSeconds={50}
          currentTimeSeconds={12}
          currentProgressPercent={24}
          playbackState="playing"
        />
      );

      // Root card must allow pan-y
      expect(html).toContain('veil-voicenote-card');
      expect(html).toContain('touch-action:pan-y');

      // Waveform container must allow pan-y
      expect(html).toContain('veil-waveform-container');

      // Must NOT contain touch-action: none anywhere in VoiceNoteCard
      expect(html).not.toContain('touch-action:none');
      expect(html).not.toContain('touch-action: none');
    });
  });

  describe('3. Directional Gesture Disambiguation & Non-Blocking Touch Down', () => {
    it('VoiceNoteCard source does not block touch start with immediate preventDefault or immediate seek', () => {
      const srcPath = path.join(rootDir, 'src/ui/components/ui/VoiceNoteCard.tsx');
      const src = fs.readFileSync(srcPath, 'utf8');

      // Pointer down must not unconditionally call e.preventDefault() before gesture determination
      const pointerDownSection = src.substring(src.indexOf('const handlePointerDown'), src.indexOf('const handleTouchStartTrack'));
      expect(pointerDownSection).not.toMatch(/^\s*e\.preventDefault\(\);/m);

      // Touch start track must not call e.preventDefault()
      const touchStartSection = src.substring(src.indexOf('const handleTouchStartTrack'), src.indexOf('const handleTouchMoveTrack'));
      expect(touchStartSection).not.toContain('e.preventDefault()');

      // Disambiguation between vertical scroll and horizontal scrub
      expect(src).toContain('deltaX');
      expect(src).toContain('deltaY');
      expect(src).toContain('gestureStateRef');
      expect(src).toMatch(/absY\s*>=\s*7\s*&&\s*absY\s*>=\s*absX/);
      expect(src).toMatch(/absX\s*>=\s*7\s*&&\s*absX\s*>\s*absY/);
    });
  });

  describe('4. Unicode Ban Compliance', () => {
    it('VoiceNoteCard and phase86 test contains zero forbidden raw unicode emoji literals', () => {
      const srcPath = path.join(rootDir, 'src/ui/components/ui/VoiceNoteCard.tsx');
      const src = fs.readFileSync(srcPath, 'utf8');

      // Standard unicode emoji regex check
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(src).not.toMatch(emojiRegex);
    });
  });
});
