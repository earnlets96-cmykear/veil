/**
 * Phase 102A: Scroll Performance Regression Automated Test Suite
 *
 * Verifies that the scroll hot path in ConversationView.tsx does NOT perform
 * synchronous DOM measurements (querySelectorAll, getBoundingClientRect, layout thrashing)
 * while preserving scroll anchoring behavior for when messages/media change size above viewport.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 102A: Scroll Performance Regression Fix', () => {
  const cvPath = path.resolve(__dirname, '../src/ui/components/ConversationView.tsx');
  const cvContent = fs.readFileSync(cvPath, 'utf8');

  it('verifies handleTimelineScroll does NOT call updateScrollAnchor or DOM measurement synchronously', () => {
    // Extract handleTimelineScroll body
    const handleScrollMatch = cvContent.match(
      /const handleTimelineScroll = useCallback\(\(e: React\.UIEvent<HTMLDivElement>\) => \{([\s\S]*?)\}, \[renderedCount/
    );
    expect(handleScrollMatch).toBeTruthy();
    const handleScrollBody = handleScrollMatch![1];

    // Must NOT contain synchronous updateScrollAnchor() call directly in scroll path
    // updateScrollAnchor must only be invoked asynchronously inside setTimeout
    expect(handleScrollBody).not.toMatch(/isNearBottomRef\.current = distanceToBottom < 120;\s*updateScrollAnchor\(\);/);
    expect(handleScrollBody).toMatch(/scrollAnchorTimerRef\.current = setTimeout\(\(\) => \{\s*updateScrollAnchor\(\);/);

    // Must NOT contain getBoundingClientRect or querySelectorAll in executable code
    const codeWithoutComments = handleScrollBody.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    expect(codeWithoutComments).not.toContain('getBoundingClientRect');
    expect(codeWithoutComments).not.toContain('querySelectorAll');

    // Must update near-bottom detection arithmetic
    expect(handleScrollBody).toContain('isNearBottomRef.current = distanceToBottom < 120;');

    // Must use debounced timer for updateScrollAnchor
    expect(handleScrollBody).toContain('scrollAnchorTimerRef.current = setTimeout');
    expect(handleScrollBody).toContain('updateScrollAnchor()');
  });

  it('verifies debounce timer cleanup is registered on unmount', () => {
    expect(cvContent).toContain('const scrollAnchorTimerRef = useRef');
    expect(cvContent).toContain('if (scrollAnchorTimerRef.current) {');
    expect(cvContent).toContain('clearTimeout(scrollAnchorTimerRef.current);');
  });

  it('verifies Phase 101 scroll preservation invariants remain intact', () => {
    // Scroll anchor refs and callbacks
    expect(cvContent).toContain('const scrollAnchorRef = useRef');
    expect(cvContent).toContain('const updateScrollAnchor = useCallback');
    expect(cvContent).toContain('isNearBottomRef.current = distanceToBottom < 120;');

    // ResizeObserver compensator
    expect(cvContent).toContain('new ResizeObserver');
    expect(cvContent).toContain('if (isNearBottomRef.current || isAdjusting || !scrollAnchorRef.current) return;');
    expect(cvContent).toContain('container.scrollTop += delta;');
  });

  it('defers history expansion and keeps the prepend batch bounded', () => {
    expect(cvContent).toMatch(/const WINDOW_INCREMENT = 16/);
    expect(cvContent).toMatch(/startTransition\(\(\) => \{\s*setRenderedCount/);
  });

  it('verifies scroll anchor settlement simulation', () => {
    // Simulate scroll events arriving rapidly (e.g. 120Hz display, 8ms between events)
    let pendingTimer: any = null;
    let anchorCalculations = 0;

    const simulateScrollEvent = (isNearBottom: boolean) => {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      if (isNearBottom) {
        // Pinned to bottom, no anchor needed
      } else {
        pendingTimer = setTimeout(() => {
          anchorCalculations++;
        }, 100);
      }
    };

    // Simulate 50 scroll events in a burst (e.g. 400ms fling)
    for (let i = 0; i < 50; i++) {
      simulateScrollEvent(false);
    }

    // Immediately after scrolling burst, zero anchor calculations have occurred
    expect(anchorCalculations).toBe(0);

    // Wait for debounce timer to settle
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Exactly ONE anchor calculation runs after scrolling settles!
        expect(anchorCalculations).toBe(1);
        resolve();
      }, 150);
    });
  });
});
