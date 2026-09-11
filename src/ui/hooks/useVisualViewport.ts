/**
 * Visual Viewport & Virtual Keyboard Inset Management Hook.
 *
 * Solves mobile virtual keyboard overlap issues by:
 * 1. Tracking window.visualViewport height and offset with pixel precision.
 * 2. Exposing CSS custom properties:
 *    --veil-visual-viewport-height (active visible height above keyboard)
 *    --veil-keyboard-height (height of software keyboard, or 0)
 * 3. Enforcing body scroll lock: prevents window/body from scrolling when inputs focus,
 *    keeping the chat timeline as the only scrollable element.
 * 4. Tagging document.body with [data-keyboard-open="true"] for adaptive CSS styling.
 */

import { useState, useEffect } from 'react';

export interface VisualViewportState {
  visualViewportHeight: number;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
}

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => {
    if (typeof window === 'undefined') {
      return { visualViewportHeight: 800, keyboardHeight: 0, isKeyboardOpen: false };
    }
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const offset = vv ? Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0)) : 0;
    return {
      visualViewportHeight: height,
      keyboardHeight: offset,
      isKeyboardOpen: offset > 60,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop || 0 : 0;
      const keyboardHeight = vv ? Math.max(0, window.innerHeight - height - offsetTop) : 0;
      const isKeyboardOpen = keyboardHeight > 60;

      // Update CSS variables on document root
      document.documentElement.style.setProperty('--veil-visual-viewport-height', `${height}px`);
      document.documentElement.style.setProperty('--veil-keyboard-height', `${keyboardHeight}px`);

      if (isKeyboardOpen) {
        document.body.setAttribute('data-keyboard-open', 'true');
      } else {
        document.body.removeAttribute('data-keyboard-open');
      }

      setState({
        visualViewportHeight: height,
        keyboardHeight,
        isKeyboardOpen,
      });
    };

    // Lock page window scroll to prevent composer from being pushed off-screen
    const lockWindowScroll = () => {
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
        window.scrollTo(0, 0);
      }
    };

    updateViewport();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateViewport);
      vv.addEventListener('scroll', updateViewport);
    }
    window.addEventListener('resize', updateViewport);
    window.addEventListener('scroll', lockWindowScroll, { passive: true });

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateViewport);
        vv.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('scroll', lockWindowScroll);
      document.body.removeAttribute('data-keyboard-open');
    };
  }, []);

  return state;
}
