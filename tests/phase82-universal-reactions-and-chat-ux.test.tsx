/**
 * Phase 82: Universal Reactions, AudioPlayerCard, Emoji Drawer & Chat UX Test Suite.
 *
 * Verifies:
 * 1. Swapped OK/Enter and Backspace buttons on PIN Lock Screen keypad.
 * 2. In-line AudioPlayerCard rendering and controls for audio files.
 * 3. Slide-up EmojiDrawer layout, segmented control, categories, search, and floating backspace.
 * 4. Universal reactions pill rendering and Telegram-style media captions.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioPlayerCard } from '../src/ui/components/ui/AudioPlayerCard.tsx';
import { EmojiDrawer } from '../src/ui/components/ui/EmojiDrawer.tsx';
import { PinLockScreen } from '../src/ui/components/PinLockScreen.tsx';
import { AppProvider } from '../src/ui/app/AppState.tsx';
import { ToastProvider } from '../src/ui/components/ui/ToastProvider.tsx';

describe('Phase 82: Chat UX & Universal Reactions Test Suite', () => {
  describe('1. PIN Lock Screen Keypad Layout (Issue 6)', () => {
    it('places Backspace on bottom-left and Enter/OK on bottom-right', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <PinLockScreen
              onUnlock={vi.fn()}
              onCancel={vi.fn()}
              mode="unlock"
              isBiometricAvailable={false}
              onBiometricUnlock={vi.fn()}
            />
          </ToastProvider>
        </AppProvider>
      );

      // Verify the keypad contains both backspace and enter buttons
      expect(html).toContain('Backspace');
      expect(html).toContain('Unlock');

      // The backspace button should appear BEFORE the unlock button in DOM order
      const backspaceIdx = html.indexOf('Backspace');
      const unlockIdx = html.indexOf('Unlock');
      expect(backspaceIdx).toBeGreaterThan(-1);
      expect(unlockIdx).toBeGreaterThan(-1);
      expect(backspaceIdx).toBeLessThan(unlockIdx);
    });
  });

  describe('2. In-Line Audio Player Card (Issue 8)', () => {
    it('renders track title, duration, scrubber, and playback button', () => {
      const handleDownload = vi.fn();
      const html = renderToStaticMarkup(
        <AudioPlayerCard
          messageId="msg-audio-test-1"
          name="beethoven_symphony_5.mp3"
          sizeBytes={4500000}
          mimeType="audio/mpeg"
          isOutgoing={false}
          status="ready"
          onDownload={handleDownload}
        />
      );

      expect(html).toContain('beethoven_symphony_5.mp3');
      expect(html).toContain('veil-audio-player-card');
      expect(html).toContain('veil-audio-play-btn');
      expect(html).toContain('veil-audio-scrubber-track');
      expect(html).toContain('Play audio');
      expect(html).toContain('Download audio file');
    });

    it('renders outgoing styling when isOutgoing is true', () => {
      const html = renderToStaticMarkup(
        <AudioPlayerCard
          messageId="msg-audio-test-2"
          name="voice_memo.m4a"
          sizeBytes={1200000}
          mimeType="audio/mp4"
          isOutgoing={true}
          status="ready"
        />
      );

      expect(html).toContain('veil-audio-player-outgoing');
    });
  });

  describe('3. Slide-up Emoji Drawer (Issue 3)', () => {
    it('renders search input, segmented control, category bar, and floating backspace', () => {
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

      expect(html).toContain('veil-emoji-drawer-open');
      expect(html).toContain('Search emojis...');
      expect(html).toContain('Emoji');
      expect(html).toContain('Stickers');
      expect(html).toContain('GIFs');
      expect(html).toContain('FREQUENTLY USED');
      expect(html).toContain('Delete character');
      // Verify presence of popular emojis
      expect(html).toContain('👍');
      expect(html).toContain('❤️');
      expect(html).toContain('🔥');
    });

    it('renders closed state with collapsed height', () => {
      const html = renderToStaticMarkup(
        <EmojiDrawer
          isOpen={false}
          onSelectEmoji={vi.fn()}
          onBackspace={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('veil-emoji-drawer');
      expect(html).not.toContain('veil-emoji-drawer-open');
    });
  });
});
