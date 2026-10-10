import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sidebar = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/Sidebar.tsx'), 'utf8');

describe('Sidebar touch navigation and quick lock menu', () => {
  it('moves between the All, Unread, and Groups filters with horizontal list swipes', () => {
    expect(sidebar).toContain("const tabs = ['all', 'unread', 'group'] as const");
    expect(sidebar).toContain('onTouchStart={handleTabSwipeStart}');
    expect(sidebar).toContain('onTouchEnd={handleTabSwipeEnd}');
    expect(sidebar).toContain('Math.abs(deltaX) < Math.abs(deltaY) * 1.25');
  });

  it('keeps swipe gestures from replacing taps on interactive list controls', () => {
    expect(sidebar).toContain("target?.closest('button, a, input, textarea, select, [role=\"slider\"]')");
    expect(sidebar).toContain('onClickCapture={(event) => {');
    expect(sidebar).toContain('suppressListClickUntilRef.current = Date.now() + 700');
  });

  it('dismisses the quick lock menu on outside interaction and Escape', () => {
    expect(sidebar).toContain("document.addEventListener('pointerdown', handleOutsidePointerDown, true)");
    expect(sidebar).toContain("if (event.key === 'Escape') setShowQuickMenu(false)");
    expect(sidebar).toContain('aria-haspopup="menu"');
  });

  it('raises the floating new chat action above the Android bottom safe area', () => {
    expect(sidebar).toContain("bottom: 'calc(40px + env(safe-area-inset-bottom, 0px))'");
  });
});
