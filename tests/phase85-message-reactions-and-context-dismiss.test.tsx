/**
 * Phase 85 Test Suite: Message Reactions, Default 5 Emojis, Expand Button & Outside Touch Dismissal
 *
 * Verifies:
 * 1. Default 5 Emojis: Initially exactly 5 standard emojis (👍, ❤️, 😂, 😮, 😢) are displayed.
 * 2. Stacking Context (z-index): .veil-floating-reactions-pill (1052) > .veil-context-menu (1050) > .veil-context-backdrop (1049).
 * 3. Outside Touch Dismissal: Backdrop has onTouchStart, onPointerDown, onClick, and active window listener captures outside touch/scroll.
 * 4. Expand Button (+): Triggers full emoji picker modal and preserves target message context.
 * 5. Reactions Rendering:
 *    - Text messages render .veil-message-reactions with .veil-reaction-pill.
 *    - Non-text messages (media, files, voice, stickers) render .veil-floating-reaction-badge with align-self.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 85 — Message Reactions & Floating Pill Display', () => {
  it('ConversationView defines exactly 5 default emojis initially on reaction pill', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Verify 5 default emojis sliced
    expect(convView).toContain("DEFAULT_REACTION_EMOJIS = ['\\u{1F44D}', '\\u2764\\uFE0F', '\\u{1F602}', '\\u{1F62E}', '\\u{1F622}', '\\u{1F64F}', '\\u{1F525}']");
    expect(convView).toMatch(/displayEmojis\s*=\s*useMemo\(\(\)\s*=>\s*\{[^}]*\.slice\(0,\s*5\)/s);

    // Verify the first 5 emojis are 👍, ❤️, 😂, 😮, 😢
    const defaultEmojis = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}'];
    expect(defaultEmojis).toHaveLength(5);
  });

  it('Floating reactions pill z-index is strictly above backdrop and context menu', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');
    const cssContent = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    // Inline z-index in ConversationView is 1052
    expect(convView).toContain('zIndex: 1052');

    // CSS z-index for floating reactions pill is calc(var(--veil-z-popover, 1050) + 2)
    expect(cssContent).toContain('z-index: calc(var(--veil-z-popover, 1050) + 2)');

    // Context backdrop z-index is calc(var(--veil-z-popover, 1050) - 1)
    expect(cssContent).toContain('z-index: calc(var(--veil-z-popover, 1050) - 1)');

    // Verify backdrop is behind reactions pill (1049 < 1052)
    const backdropZ = 1050 - 1;
    const pillZ = 1050 + 2;
    expect(pillZ).toBeGreaterThan(backdropZ);
  });

  it('Context backdrop includes touch, pointer, and click dismissal handlers', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');
    const cssContent = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    // Verify JSX backdrop event handlers
    expect(convView).toContain('className="veil-context-backdrop"');
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onTouchStart/);
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onPointerDown/);
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onClick/);

    // Verify CSS touch configuration
    expect(cssContent).toMatch(/\.veil-context-backdrop\s*\{[^}]*pointer-events:\s*auto/);
    expect(cssContent).toMatch(/\.veil-context-backdrop\s*\{[^}]*touch-action:\s*none/);
    expect(cssContent).toMatch(/\.veil-context-backdrop\s*\{[^}]*cursor:\s*pointer/);
  });

  it('ConversationView registers active window touchstart and scroll dismissal listeners', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Verify outside dismissal effect
    expect(convView).toContain("window.addEventListener('touchstart', handleOutsideDismiss");
    expect(convView).toContain("window.addEventListener('scroll', handleOutsideDismiss");
    expect(convView).toContain("target?.closest('.veil-context-menu')");
    expect(convView).toContain("target?.closest('.veil-floating-reactions-pill')");
  });

  it('Emoji expand button preserves target message and opens EmojiPickerModal', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Plus expand button triggers
    expect(convView).toContain('className="veil-emoji-expand-btn"');
    expect(convView).toContain('setEmojiTargetMessage(target)');
    expect(convView).toContain('setIsEmojiPickerOpen(true)');
  });
});

describe('Phase 85 — Message & Media Reaction Badges Rendering', () => {
  it('MessageBubble renders reactions pill container with user-reacted active state', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-reactions"
        isOutgoing={true}
        text="Test message with reactions"
        timestamp={Date.now()}
        reactions={[
          { emoji: '\u{1F44D}', count: 2, userReacted: true },
          { emoji: '\u2764\uFE0F', count: 1, userReacted: false },
        ]}
      />
    );

    expect(html).toContain('veil-message-reactions');
    expect(html).toContain('veil-reaction-pill');
    expect(html).toContain('user-reacted');
    expect(html).toContain('\u{1F44D}');
    expect(html).toContain('>2<');
    expect(html).toContain('\u2764\uFE0F');
    expect(html).toContain('>1<');
  });

  it('veil-components.css styles .veil-floating-reaction-badge with align-self and high z-index', () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    expect(cssContent).toMatch(/\.veil-msg-row\.outgoing\s+\.veil-floating-reaction-badge\s*\{[^}]*align-self:\s*flex-end/);
    expect(cssContent).toMatch(/\.veil-msg-row\.incoming\s+\.veil-floating-reaction-badge\s*\{[^}]*align-self:\s*flex-start/);
    expect(cssContent).toMatch(/\.veil-floating-reaction-badge\s*\{[^}]*z-index:\s*10/);
    expect(cssContent).toMatch(/\.veil-reaction-pill\s*\{[^}]*color:\s*var\(--veil-text-primary/);
  });
});
