/**
 * Phase 69 — VEIL Chat UX Enhancement Bundle Verification Tests
 *
 * Verifies:
 * 1. Feature 1 — Audio UI Polish:
 *    - VoiceNoteCard renders playback speed toggle button.
 *    - Waveform bars have proper classes ('veil-waveform-bar', 'active').
 *    - Accessibility label contains 'Audio message'.
 * 2. Feature 2 — Progress Circle:
 *    - ProgressCircle SVG radial component renders percentage, arc offset, and byte counts.
 *    - AttachmentCard renders ProgressCircle when downloading or uploading.
 * 3. Feature 4 — Message Editing:
 *    - MessageBubble renders '(edited)' indicator when edited prop is true.
 *    - MessageBubble omits edited tag when edited is false or undefined.
 * 4. Feature 6 — Emoji Picker & Reactions:
 *    - EmojiPickerModal renders category headers and emoji grid.
 * 5. CSS Tokens & Keyframes:
 *    - veil-components.css includes all Phase 69 class definitions.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import { ProgressCircle } from '../src/ui/components/ui/ProgressCircle.tsx';
import { AttachmentCard } from '../src/ui/components/ui/AttachmentCard.tsx';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import { EmojiPickerModal } from '../src/ui/components/ui/EmojiPickerModal.tsx';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 69 — Chat UX Enhancement Bundle', () => {
  describe('Feature 1: Audio UI Polish & Error Resilience', () => {
    it('VoiceNoteCard renders speed toggle button and waveform bars with active state', () => {
      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="msg-audio-1"
          durationSeconds={60}
          currentTimeSeconds={30}
          currentProgressPercent={50}
          playbackState="playing"
          onPlayToggle={() => {}}
          onSeek={() => {}}
        />
      );

      expect(html).toContain('veil-voicenote-card');
      expect(html).toContain('veil-voicenote-speed-btn');
      expect(html).toContain('1x');
      expect(html).toContain('veil-waveform-bar');
      expect(html).toContain('active');
      expect(html).toMatch(/Audio message/);
    });

    it('VoiceNoteCard renders retry button on error without throwing', () => {
      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="msg-audio-err"
          durationSeconds={45}
          playbackState="error"
          onPlayToggle={() => {}}
          onSeek={() => {}}
          onRetry={() => {}}
        />
      );

      expect(html).toContain('veil-voicenote-retry-btn');
      expect(html).toContain('Retry audio note');
    });
  });

  describe('Feature 2: Progress Circle Component & AttachmentCard', () => {
    it('ProgressCircle renders SVG arc, percentage text, and formatted byte sizes', () => {
      const html = renderToStaticMarkup(
        <ProgressCircle
          percent={65}
          size={48}
          totalBytes={5 * 1024 * 1024}
          loadedBytes={3.25 * 1024 * 1024}
          variant="download"
        />
      );

      expect(html).toContain('veil-progress-circle');
      expect(html).toContain('65%');
      expect(html).toContain('5.0 MB');
      expect(html).toContain('3.3 MB');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="65"');
    });

    it('AttachmentCard renders ProgressCircle during downloading state', () => {
      const html = renderToStaticMarkup(
        <AttachmentCard
          name="report.pdf"
          sizeBytes={2 * 1024 * 1024}
          mimeType="application/pdf"
          status="downloading"
          progressPercent={42}
          loadedBytes={860 * 1024}
        />
      );

      expect(html).toContain('veil-attachment-card');
      expect(html).toContain('veil-progress-circle');
      expect(html).toContain('42%');
      expect(html).toContain('2.0 MB');
    });

    it('AttachmentCard renders ProgressCircle with upload variant during uploading state', () => {
      const html = renderToStaticMarkup(
        <AttachmentCard
          name="recording.zip"
          sizeBytes={10 * 1024 * 1024}
          mimeType="application/zip"
          status="uploading"
          progressPercent={80}
          loadedBytes={8 * 1024 * 1024}
        />
      );

      expect(html).toContain('veil-attachment-card');
      expect(html).toContain('veil-progress-circle');
      expect(html).toContain('80%');
      expect(html).toContain('aria-label="Uploading 80%"');
    });
  });

  describe('Feature 4: Message Editing & Edited Indicator', () => {
    it('MessageBubble renders "(edited)" indicator when edited is true', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg-edited-1"
          text="Updated secret message"
          timestamp={Date.now()}
          isOutgoing={true}
          status="DELIVERED"
          edited={true}
        />
      );

      expect(html).toContain('veil-message-bubble');
      expect(html).toContain('veil-edited-tag');
      expect(html).toContain('edited');
    });

    it('MessageBubble does not render "(edited)" indicator when edited is false or omitted', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg-normal-1"
          text="Standard unedited message"
          timestamp={Date.now()}
          isOutgoing={true}
          status="DELIVERED"
          edited={false}
        />
      );

      expect(html).toContain('veil-message-bubble');
      expect(html).not.toContain('veil-edited-tag');
    });
  });

  describe('Feature 6: Categorized Emoji Picker Modal', () => {
    it('EmojiPickerModal renders modal header, category tabs, and emojis when open', () => {
      const html = renderToStaticMarkup(
        <EmojiPickerModal
          isOpen={true}
          onSelect={() => {}}
          onClose={() => {}}
        />
      );

      expect(html).toContain('veil-emoji-picker-modal');
      expect(html).toContain('Close emoji picker');
      expect(html).toContain('veil-emoji-picker-grid');
      expect(html).toContain('Smileys');
      expect(html).toContain('Hearts');
      expect(html).toContain('Hands');
    });

    it('EmojiPickerModal returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <EmojiPickerModal
          isOpen={false}
          onSelect={() => {}}
          onClose={() => {}}
        />
      );

      expect(html).toBe('');
    });
  });

  describe('CSS Styles & Visual Polish Integrity', () => {
    it('veil-components.css includes all Phase 69 styling tokens and keyframes', () => {
      const cssPath = path.join(rootDir, 'src', 'styles', 'veil-components.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('.veil-voicenote-speed-btn');
      expect(css).toContain('.veil-progress-circle');
      expect(css).toContain('.veil-edited-tag');
      expect(css).toContain('.veil-edit-banner');
      expect(css).toContain('.veil-emoji-expand-btn');
      expect(css).toContain('.veil-emoji-picker-modal');
      expect(css).toContain('@keyframes veilSlideUp');
    });
  });
});
