import { describe, expect, it } from 'vitest';
import {
  shouldCompleteConversationBackSwipe,
  shouldDismissMediaByDrag,
} from '../src/ui/utils/mobileGesturePhysics.ts';

describe('Phase 71: mobile navigation gesture physics', () => {
  it('leaves a chat only after a deliberate rightward swipe from the logical start edge', () => {
    expect(
      shouldCompleteConversationBackSwipe({
        startX: 12,
        viewportWidth: 390,
        deltaX: 76,
        deltaY: 8,
        direction: 'ltr',
      })
    ).toBe(true);
  });

  it('rejects chat-back drags that start away from the edge or become vertical scrolling', () => {
    expect(
      shouldCompleteConversationBackSwipe({
        startX: 80,
        viewportWidth: 390,
        deltaX: 120,
        deltaY: 4,
        direction: 'ltr',
      })
    ).toBe(false);
    expect(
      shouldCompleteConversationBackSwipe({
        startX: 12,
        viewportWidth: 390,
        deltaX: 80,
        deltaY: 95,
        direction: 'ltr',
      })
    ).toBe(false);
  });

  it('mirrors the edge and direction for RTL chats', () => {
    expect(
      shouldCompleteConversationBackSwipe({
        startX: 382,
        viewportWidth: 390,
        deltaX: -76,
        deltaY: 5,
        direction: 'rtl',
      })
    ).toBe(true);
  });

  it('dismisses focused media only for a long, downward, vertical drag at base zoom', () => {
    expect(shouldDismissMediaByDrag({ deltaX: 8, deltaY: 130, zoom: 1 })).toBe(true);
    expect(shouldDismissMediaByDrag({ deltaX: 8, deltaY: 119, zoom: 1 })).toBe(false);
    expect(shouldDismissMediaByDrag({ deltaX: 130, deltaY: 40, zoom: 1 })).toBe(false);
    expect(shouldDismissMediaByDrag({ deltaX: 8, deltaY: 150, zoom: 2 })).toBe(false);
  });
});
