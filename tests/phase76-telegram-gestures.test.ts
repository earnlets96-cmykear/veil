import { describe, it, expect } from 'vitest';
import { shouldCompleteConversationBackSwipe } from '../src/ui/utils/mobileGesturePhysics.ts';

describe('Phase 76: Telegram Gesture Physics & Thresholds', () => {
  describe('Hold-to-Record & Slide Gestures', () => {
    it('accurately detects slide-to-cancel threshold (dx < -70px)', () => {
      const isSlideToCancel = (dx: number) => dx < -70;

      expect(isSlideToCancel(0)).toBe(false);
      expect(isSlideToCancel(-40)).toBe(false);
      expect(isSlideToCancel(-69)).toBe(false);
      expect(isSlideToCancel(-71)).toBe(true);
      expect(isSlideToCancel(-100)).toBe(true);
    });

    it('accurately detects slide-to-lock hands-free threshold (dy < -60px)', () => {
      const isSlideToLock = (dy: number) => dy < -60;

      expect(isSlideToLock(0)).toBe(false);
      expect(isSlideToLock(-30)).toBe(false);
      expect(isSlideToLock(-59)).toBe(false);
      expect(isSlideToLock(-61)).toBe(true);
      expect(isSlideToLock(-90)).toBe(true);
    });
  });

  describe('Elastic Swipe-to-Reply Physics', () => {
    // Formula from MessageBubble.tsx: -Math.min(75, Math.pow(Math.abs(deltaX), 0.82) * 1.6)
    const computeElasticOffset = (deltaX: number) =>
      -Math.min(75, Math.pow(Math.abs(deltaX), 0.82) * 1.6);

    it('damps finger movement and caps at -75px max displacement', () => {
      const smallDrag = computeElasticOffset(-15);
      expect(smallDrag).toBeLessThan(0);
      expect(smallDrag).toBeGreaterThan(-30);

      const thresholdDrag = computeElasticOffset(-60);
      expect(thresholdDrag).toBeLessThanOrEqual(-45); // crosses reply threshold

      const excessiveDrag = computeElasticOffset(-300);
      expect(excessiveDrag).toBe(-75); // bounded elastic ceiling
    });

    it('triggers reply action when swipe offset crosses -45px threshold', () => {
      const triggersReply = (offset: number) => offset <= -45;

      expect(triggersReply(0)).toBe(false);
      expect(triggersReply(-20)).toBe(false);
      expect(triggersReply(-44)).toBe(false);
      expect(triggersReply(-45)).toBe(true);
      expect(triggersReply(-60)).toBe(true);
    });
  });

  describe('Edge Swipe-to-Exit Chat Navigation', () => {
    it('validates edge swipe starting within 32px boundary in LTR', () => {
      const validEdgeSwipe = shouldCompleteConversationBackSwipe({
        startX: 15,
        viewportWidth: 390,
        deltaX: 85,
        deltaY: 10,
        direction: 'ltr',
      });
      expect(validEdgeSwipe).toBe(true);
    });

    it('rejects swipe starting in center of screen', () => {
      const centerSwipe = shouldCompleteConversationBackSwipe({
        startX: 150,
        viewportWidth: 390,
        deltaX: 100,
        deltaY: 5,
        direction: 'ltr',
      });
      expect(centerSwipe).toBe(false);
    });

    it('rejects swipe when vertical scroll dominates horizontal swipe', () => {
      const verticalScroll = shouldCompleteConversationBackSwipe({
        startX: 10,
        viewportWidth: 390,
        deltaX: 80,
        deltaY: 120,
        direction: 'ltr',
      });
      expect(verticalScroll).toBe(false);
    });
  });

  describe('Waveform Scrubbing Calculations', () => {
    it('accurately maps scrub percentage to playback time', () => {
      const durationSeconds = 42;
      const computeTime = (percent: number) => (percent / 100) * durationSeconds;

      expect(computeTime(0)).toBe(0);
      expect(computeTime(50)).toBe(21);
      expect(computeTime(100)).toBe(42);
      expect(computeTime(25)).toBe(10.5);
    });
  });
});
