/**
 * Phase 89 Test Suite: Universal Message Context Menu & Reactions Bar Outside-Press Dismissal
 *
 * Verifies:
 * 1. Window Capture Phase Interception:
 *    - ConversationView registers window listeners with { capture: true } for:
 *      pointerdown, mousedown, touchstart, click, contextmenu, scroll.
 *    - This guarantees outside clicks/taps are intercepted before child bubbles can stop propagation.
 * 2. Event Absorption on Outside Dismiss:
 *    - Outside events call preventDefault(), stopPropagation(), and stopImmediatePropagation()
 *      so that underlying elements (voice playback, media preview, text selection, inputs) are never activated.
 * 3. Menu & Reactions Interaction Protection:
 *    - Clicks/touches inside .veil-context-menu, .veil-floating-reactions-pill, or .veil-emoji-picker-modal
 *      are recognized and permitted without dismissal.
 * 4. Debounce Guard Against Trigger Event:
 *    - menuOpenedAtRef tracks opening timestamp; events within 60ms of opening are ignored to prevent
 *      the opening touch/click from immediately dismissing the newly opened menu.
 * 5. Full-Screen Backdrop Absorption:
 *    - .veil-context-backdrop has onClick, onTouchStart, onTouchEnd, onPointerDown, onMouseDown handlers
 *      with preventDefault() and stopPropagation().
 *    - CSS covers inset: 0, 100vw x 100vh with appropriate z-index (1049).
 * 6. Phase 44a Zero Raw Literal Emoji Compliance:
 *    - Touched files strictly use Unicode escapes (\u{...}) or SVG icons, zero raw emoji characters.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 89 — Message Context Menu & Reactions Bar Outside-Press Dismissal', () => {
  it('ConversationView registers capture-phase window listeners for all pointer, touch, and mouse events', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Verify all event types registered with capture: true
    expect(convView).toContain("window.addEventListener('pointerdown', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.addEventListener('mousedown', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.addEventListener('touchstart', handleOutsideDismiss, { capture: true, passive: false })");
    expect(convView).toContain("window.addEventListener('click', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.addEventListener('contextmenu', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.addEventListener('scroll', handleOutsideDismiss, { capture: true, passive: true })");
    expect(convView).toContain("window.addEventListener('resize', handleOutsideDismiss, { passive: true })");

    // Verify clean teardown in useEffect cleanup
    expect(convView).toContain("window.removeEventListener('pointerdown', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.removeEventListener('mousedown', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.removeEventListener('touchstart', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.removeEventListener('click', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.removeEventListener('contextmenu', handleOutsideDismiss, { capture: true })");
    expect(convView).toContain("window.removeEventListener('scroll', handleOutsideDismiss, { capture: true })");
  });

  it('Outside dismiss handler absorbs events with preventDefault, stopPropagation, and stopImmediatePropagation', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Check absorption logic inside handleOutsideDismiss
    expect(convView).toMatch(/if\s*\(\s*e\.cancelable\s*\)\s*\{\s*e\.preventDefault\(\);\s*\}/);
    expect(convView).toMatch(/e\.stopPropagation\(\);/);
    expect(convView).toContain('(e as any).stopImmediatePropagation?.();');

    // Check that contextMenu state is closed
    expect(convView).toContain('setContextMenu({ isOpen: false, x: 0, y: 0, message: null })');
  });

  it('Menu, floating reaction pill, and emoji picker interactions are preserved', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Target checks to allow internal clicks
    expect(convView).toContain("target?.closest('.veil-context-menu')");
    expect(convView).toContain("target?.closest('.veil-floating-reactions-pill')");
    expect(convView).toContain("target?.closest('.veil-emoji-picker-modal')");
  });

  it('Debounce guard prevents initial menu-open gesture from triggering dismissal', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Verify ref exists
    expect(convView).toContain('menuOpenedAtRef = useRef<number>(0)');

    // Verify handleContextMenu stamps the opening time
    expect(convView).toMatch(/menuOpenedAtRef\.current\s*=\s*Date\.now\(\);/);

    // Verify debounce check in handleOutsideDismiss
    expect(convView).toMatch(/Date\.now\(\)\s*-\s*menuOpenedAtRef\.current\s*<\s*60/);
  });

  it('Context backdrop covers viewport and absorbs touch, pointer, and mouse events in JSX', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    // JSX backdrop handlers
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);[\s\S]*?setContextMenu/);
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onTouchStart=\{\(e\)\s*=>\s*\{[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);[\s\S]*?setContextMenu/);
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);/);
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onPointerDown=\{\(e\)\s*=>\s*\{[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);[\s\S]*?setContextMenu/);
    expect(convView).toMatch(/className="veil-context-backdrop"[\s\S]*?onMouseDown=\{\(e\)\s*=>\s*\{[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);[\s\S]*?setContextMenu/);

    // CSS styling
    expect(css).toMatch(/\.veil-context-backdrop\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.veil-context-backdrop\s*\{[^}]*inset:\s*0/);
    expect(css).toMatch(/\.veil-context-backdrop\s*\{[^}]*width:\s*100vw/);
    expect(css).toMatch(/\.veil-context-backdrop\s*\{[^}]*height:\s*100vh/);
    expect(css).toMatch(/\.veil-context-backdrop\s*\{[^}]*z-index:\s*calc\(var\(--veil-z-popover,\s*1050\)\s*-\s*1\)/);
    expect(css).toMatch(/\.veil-context-backdrop\s*\{[^}]*pointer-events:\s*auto/);
    expect(css).toMatch(/\.veil-context-backdrop\s*\{[^}]*touch-action:\s*none/);
  });

  it('Phase 44a Zero Raw Unicode Emoji Compliance in touched files', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Emoji regex to detect raw unescaped emojis
    const rawEmojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

    expect(rawEmojiRegex.test(convView)).toBe(false);
  });
});
