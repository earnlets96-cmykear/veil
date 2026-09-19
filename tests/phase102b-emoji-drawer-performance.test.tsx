/**
 * Phase 102B: Emoji Drawer Performance Regression Automated Test Suite
 *
 * Verifies that:
 * 1. Opening the drawer renders ONLY the active category, NOT every category simultaneously.
 * 2. Inactive categories are unmounted and absent from the rendered markup.
 * 3. Every single category in EMOJI_CATEGORIES remains accessible via navigation buttons.
 * 4. EmojiDrawer source code structure verifies:
 *    - Render only active category
 *    - EmojiCell is memoized with React.memo
 *    - EmojiDrawer is exported with React.memo
 *    - Zero literal unicode emojis exist in the source code (Phase 44a compliance)
 * 5. MessageComposer memoizes emoji insertion callbacks and passes them to EmojiDrawer.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';
import { EmojiDrawer } from '../src/ui/components/ui/EmojiDrawer.tsx';

describe('Phase 102B: EmojiDrawer Active-Category Rendering & Performance', () => {
  const drawerPath = path.resolve(__dirname, '../src/ui/components/ui/EmojiDrawer.tsx');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');

  const composerPath = path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx');
  const composerContent = fs.readFileSync(composerPath, 'utf-8');

  it('verifies opening the drawer renders ONLY the active category (does not mount all categories simultaneously)', () => {
    const handleSelect = vi.fn();
    const handleBackspace = vi.fn();
    const handleClose = vi.fn();

    const html = renderToStaticMarkup(
      <EmojiDrawer
        isOpen={true}
        onSelectEmoji={handleSelect}
        onBackspace={handleBackspace}
        onClose={handleClose}
      />
    );

    // Frequently Used (recent) category is rendered by default
    expect(html).toContain('id="emoji-section-recent"');
    expect(html).toContain('FREQUENTLY USED');

    // The other 8 category sections must NOT be rendered in the DOM when 'recent' is active
    expect(html).not.toContain('id="emoji-section-smileys"');
    expect(html).not.toContain('id="emoji-section-hands"');
    expect(html).not.toContain('id="emoji-section-animals"');
    expect(html).not.toContain('id="emoji-section-food"');
    expect(html).not.toContain('id="emoji-section-travel"');
    expect(html).not.toContain('id="emoji-section-activities"');
    expect(html).not.toContain('id="emoji-section-objects"');
    expect(html).not.toContain('id="emoji-section-symbols"');

    // Count rendered veil-emoji-cell buttons in HTML
    const cellMatches = html.match(/class="veil-emoji-cell"/g);
    expect(cellMatches).toBeTruthy();
    // In 'recent' category: exactly 16 emojis mounted instead of 600+!
    expect(cellMatches!.length).toBeLessThanOrEqual(24);
  });

  it('verifies all emoji categories in navigation bar remain accessible', () => {
    const html = renderToStaticMarkup(
      <EmojiDrawer
        isOpen={true}
        onSelectEmoji={vi.fn()}
        onBackspace={vi.fn()}
      />
    );

    // Navigation bar icons and titles
    expect(html).toContain('aria-label="Frequently Used"');
    expect(html).toContain('aria-label="SMILEYS &amp; EMOTION"');
    expect(html).toContain('aria-label="PEOPLE &amp; BODY"');
    expect(html).toContain('aria-label="ANIMALS &amp; NATURE"');
    expect(html).toContain('aria-label="FOOD &amp; DRINK"');
    expect(html).toContain('aria-label="TRAVEL &amp; PLACES"');
    expect(html).toContain('aria-label="ACTIVITIES"');
    expect(html).toContain('aria-label="OBJECTS"');
    expect(html).toContain('aria-label="SYMBOLS"');
  });

  it('verifies active category rendering logic in source code', () => {
    // Verifies active category selection and unmounting of inactive categories
    expect(drawerContent).toContain("activeCategoryId === 'recent'");
    expect(drawerContent).toContain('selectedCategory');
    expect(drawerContent).toContain('selectedCategory.emojis.map');

    // Verifies scrollToCategory resets scroll to top on switch
    expect(drawerContent).toContain('scrollContainerRef.current.scrollTop = 0;');
  });

  it('verifies EmojiCell is memoized and EmojiDrawer is exported with React.memo', () => {
    expect(drawerContent).toContain('const EmojiCell = React.memo');
    expect(drawerContent).toContain('export const EmojiDrawer = React.memo(EmojiDrawerComponent);');
  });

  it('verifies MessageComposer memoizes emoji callbacks to prevent re-rendering EmojiDrawer', () => {
    expect(composerContent).toContain('const handleInsertEmoji = useCallback(');
    expect(composerContent).toContain('const handleEmojiBackspace = useCallback(');
    expect(composerContent).toContain('const handleCloseEmojiDrawer = useCallback(');
    expect(composerContent).toContain('onClose={handleCloseEmojiDrawer}');
  });

  it('verifies Phase 44a Zero Literal Unicode Emoji Compliance in EmojiDrawer.tsx', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const lines = drawerContent.split('\n');

    lines.forEach((line, idx) => {
      const match = line.match(emojiRegex);
      if (match) {
        throw new Error(
          `Phase 44a Violation: Literal unicode emoji "${match[0]}" found in EmojiDrawer.tsx:${idx + 1}: ${line}`
        );
      }
    });
  });
});
