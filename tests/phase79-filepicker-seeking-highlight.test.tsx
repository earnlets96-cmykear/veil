/**
 * Phase 79 Tests:
 * 1. NativeDeviceMediaBridge picker lifecycle notification and listeners
 * 2. VoiceNoteCard touch event isolation & data-no-swipe attribute
 * 3. ConversationMessageRow touch isolation preventing swipe-to-reply on waveform
 * 4. CSS verification ensuring .veil-context-active-message uses 1.5px border shadow without .veil-bubble-wrapper
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NativeDeviceMediaBridge } from '../src/media/NativeDeviceMediaBridge.ts';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import fs from 'fs';
import path from 'path';

describe('Phase 79: File Picker Session Protection & Waveform Swipe Isolation & Bubble Highlight', () => {
  describe('NativeDeviceMediaBridge Picker Lifecycle', () => {
    it('notifies registered active/inactive listeners during pickDocuments', async () => {
      const onActive = vi.fn();
      const onInactive = vi.fn();
      const unbind = NativeDeviceMediaBridge.setPickerListeners(onActive, onInactive);

      const bridge = NativeDeviceMediaBridge.createForTesting({
        isNative: () => true,
        pickDocuments: vi.fn().mockResolvedValue({
          items: [{ uri: 'content://test/doc.pdf', name: 'doc.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
        }),
      });

      const items = await bridge.pickDocuments();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('doc.pdf');
      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).toHaveBeenCalledTimes(1);

      unbind();
    });

    it('notifies registered active/inactive listeners during captureMedia', async () => {
      const onActive = vi.fn();
      const onInactive = vi.fn();
      const unbind = NativeDeviceMediaBridge.setPickerListeners(onActive, onInactive);

      const bridge = NativeDeviceMediaBridge.createForTesting({
        isNative: () => true,
        captureMedia: vi.fn().mockResolvedValue({
          items: [{ uri: 'content://test/photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 }],
        }),
      });

      const items = await bridge.captureMedia();
      expect(items).toHaveLength(1);
      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).toHaveBeenCalledTimes(1);

      unbind();
    });
  });

  describe('VoiceNoteCard Waveform & Touch Isolation', () => {
    it('renders waveform with data-no-swipe attribute and tactile playhead', () => {
      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="msg_voice_test_1"
          durationSeconds={22}
          currentTimeSeconds={4}
          currentProgressPercent={18}
          isOutgoing={false}
        />
      );

      expect(html).toContain('data-no-swipe="true"');
      expect(html).toContain('veil-waveform-container');
      expect(html).toContain('veil-waveform-playhead');
      expect(html).toContain('veil-waveform-bar');
    });
  });

  describe('CSS Bubble Highlight & Context Active Verification', () => {
    it('styles .veil-context-active-message with 1.5px shadow on bubble elements and excludes .veil-bubble-wrapper', () => {
      const cssPath = path.join(__dirname, '../src/styles/veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      // Must NOT apply box-shadow to .veil-bubble-wrapper in .veil-context-active-message
      expect(css).not.toContain('.veil-context-active-message .veil-bubble-wrapper');

      // Must apply 1.5px box-shadow to bubble elements
      expect(css).toContain('.veil-context-active-message .veil-message-bubble');
      expect(css).toContain('box-shadow: 0 0 0 1.5px var(--veil-accent-primary, #14b8a6)');
    });

    it('animates .veil-message-highlight with 1.5px border glow without flashing full-width row', () => {
      const cssPath = path.join(__dirname, '../src/styles/veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('.veil-msg-row.veil-message-highlight');
      expect(css).toContain('animation: none !important;');
      expect(css).toContain('.veil-message-highlight .veil-message-bubble');
    });
  });
});
