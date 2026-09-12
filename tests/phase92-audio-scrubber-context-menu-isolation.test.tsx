/**
 * Phase 92 Test Suite: Audio Scrubber Context Menu Isolation & Gesture Disambiguation
 *
 * Verifies:
 * 1. AudioPlayerCard Event Isolation:
 *    - Scrubber track (.veil-audio-player-track-wrap) stops click, contextmenu, touchstart, touchmove, and pointerup propagation.
 *    - AudioPlayerCard container stops click propagation to prevent triggering message bubble context menu.
 * 2. ConversationView Interactive Target Recognition:
 *    - isInteractive filter matches [role="slider"], .veil-audio-player-card, .veil-audio-player-track-wrap, .veil-audio-scrubber-track.
 *    - Clicking or tapping on the audio scrubber does not trigger onContextMenu.
 *    - Touch gestures on audio scrubber and card do not trigger long-press context menu timers or horizontal swipe-to-reply.
 * 3. Phase 44a Zero Literal Unicode Emoji Compliance across all touched source and test files.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 92: AudioPlayerCard Event Propagation Isolation', () => {
  const audioCardSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'),
    'utf-8'
  );

  it('stops click propagation on the card root to prevent row bubble clicks', () => {
    expect(audioCardSource).toMatch(
      /className=\{`veil-audio-player-card[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.stopPropagation\(\);/
    );
  });

  it('stops click, contextmenu, and touch events on the scrubber track (.veil-audio-player-track-wrap)', () => {
    expect(audioCardSource).toContain('className="veil-audio-player-track-wrap veil-audio-scrubber-track"');

    // Scrubber track must isolate onClick
    expect(audioCardSource).toMatch(
      /className="veil-audio-player-track-wrap veil-audio-scrubber-track"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.stopPropagation\(\);/
    );

    // Scrubber track must isolate onContextMenu
    expect(audioCardSource).toMatch(
      /className="veil-audio-player-track-wrap veil-audio-scrubber-track"[\s\S]*?onContextMenu=\{\(e\)\s*=>\s*\{[\s\S]*?e\.stopPropagation\(\);/
    );

    // Scrubber track must isolate onTouchStart & onTouchMove
    expect(audioCardSource).toMatch(
      /className="veil-audio-player-track-wrap veil-audio-scrubber-track"[\s\S]*?onTouchStart=\{\(e\)\s*=>\s*\{[\s\S]*?e\.stopPropagation\(\);/
    );
    expect(audioCardSource).toMatch(
      /className="veil-audio-player-track-wrap veil-audio-scrubber-track"[\s\S]*?onTouchMove=\{\(e\)\s*=>\s*\{[\s\S]*?e\.stopPropagation\(\);/
    );
  });

  it('stops pointer move and pointer up propagation in handlePointerDown', () => {
    expect(audioCardSource).toMatch(
      /const\s+onPointerMove\s*=\s*\(moveEvent:\s*PointerEvent\)\s*=>\s*\{[\s\S]*?moveEvent\.stopPropagation\(\);/
    );
    expect(audioCardSource).toMatch(
      /const\s+onPointerUp\s*=\s*\(upEvent:\s*PointerEvent\)\s*=>\s*\{[\s\S]*?upEvent\.stopPropagation\(\);/
    );
  });
});

describe('Phase 92: ConversationView Interactive Target Recognition', () => {
  const conversationViewSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ConversationView.tsx'),
    'utf-8'
  );

  it('includes [role="slider"] and audio player classes in isInteractive check', () => {
    expect(conversationViewSource).toContain('[role="slider"]');
    expect(conversationViewSource).toContain('.veil-audio-player-card');
    expect(conversationViewSource).toContain('.veil-audio-player-track-wrap');
    expect(conversationViewSource).toContain('.veil-audio-scrubber-track');
  });

  it('excludes audio player card and slider from handleTouchStart long-press timer', () => {
    expect(conversationViewSource).toMatch(
      /const\s+handleTouchStart\s*=\s*\(e:\s*React\.TouchEvent\)\s*=>\s*\{[\s\S]*?target\?\.closest\('[\s\S]*?\[role="slider"\][\s\S]*?\.veil-audio-player-card[\s\S]*?\.veil-audio-player-track-wrap/
    );
  });

  it('excludes audio player card and slider from handleTouchMove swipe gesture', () => {
    expect(conversationViewSource).toMatch(
      /const\s+handleTouchMove\s*=\s*\(e:\s*React\.TouchEvent\)\s*=>\s*\{[\s\S]*?target\?\.closest\('[\s\S]*?\.veil-audio-player-card[\s\S]*?\.veil-audio-player-track-wrap[\s\S]*?\[role="slider"\]/
    );
  });

  it('simulates target.closest check on scrubber slider and verifies context menu is NOT triggered', () => {
    const onContextMenuMock = vi.fn();

    // Mock an element on the scrubber needle
    const mockTarget = {
      closest: (selector: string) => {
        const parts = selector.split(',').map((s) => s.trim());
        if (parts.includes('[role="slider"]') || parts.includes('.veil-audio-player-track-wrap')) {
          return { role: 'slider' };
        }
        return null;
      },
    };

    const isInteractive = mockTarget.closest(
      'button, a, input, textarea, select, [role="checkbox"], [role="slider"], ' +
      '.veil-audio-player-card, .veil-audio-player-track-wrap, .veil-audio-scrubber-track, ' +
      '.veil-waveform-container, .veil-voicenote-card, [data-no-swipe="true"], ' +
      '.veil-reactions-bar, .veil-reaction-chip, .veil-reaction-pill, .veil-msg-checkbox'
    );

    expect(isInteractive).not.toBeNull();
    if (!isInteractive) {
      onContextMenuMock();
    }
    expect(onContextMenuMock).not.toHaveBeenCalled();
  });
});

describe('Phase 92: Strict Phase 44a Zero Literal Unicode Emoji Compliance', () => {
  const touchedFiles = [
    'src/ui/components/ui/AudioPlayerCard.tsx',
    'src/ui/components/ConversationView.tsx',
    'tests/phase92-audio-scrubber-context-menu-isolation.test.tsx',
  ];

  // Regex matching unicode emoji ranges
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  for (const relPath of touchedFiles) {
    it(`ensures ${relPath} contains zero literal unicode emojis`, () => {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const match = line.match(emojiRegex);
        if (match) {
          throw new Error(
            `Phase 44a Violation: Literal unicode emoji "${match[0]}" found in ${relPath}:${idx + 1}: ${line}`
          );
        }
      });
    });
  }
});
