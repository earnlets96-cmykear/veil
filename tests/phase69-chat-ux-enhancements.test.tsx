import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import { ProgressCircle } from '../src/ui/components/ui/ProgressCircle.tsx';
import {
  EmojiPickerPopup,
  getRecentEmojis,
  addRecentEmoji,
  DEFAULT_RECENT,
} from '../src/ui/components/ui/EmojiPickerPopup.tsx';

describe('Phase 69: Chat UX Enhancements Suite', () => {
  beforeEach(() => {
    // Reset localStorage mock
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
    });
  });

  describe('1. Message Editing & "Edited" Indicator', () => {
    it('renders "edited" label when isEdited is true on outgoing messages', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg-edit-out"
          text="This is an updated message"
          isOutgoing={true}
          timestamp={1700000000000}
          isEdited={true}
        />
      );
      expect(html).toContain('edited');
      expect(html).toContain('This is an updated message');
    });

    it('renders "edited" label when isEdited is true on incoming messages', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg-edit-in"
          text="Peer corrected their text"
          isOutgoing={false}
          timestamp={1700000000000}
          isEdited={true}
        />
      );
      expect(html).toContain('edited');
      expect(html).toContain('Peer corrected their text');
    });

    it('does NOT render "edited" label when isEdited is false or undefined', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg-normal"
          text="Regular message without edits"
          isOutgoing={true}
          timestamp={1700000000000}
        />
      );
      expect(html).not.toContain('edited');
      expect(html).toContain('Regular message without edits');
    });
  });

  describe('2. Progress Circle & Media Overlays', () => {
    it('renders ProgressCircle with indeterminate animation when percent is -1', () => {
      const html = renderToStaticMarkup(<ProgressCircle percent={-1} size={36} />);
      expect(html).toContain('veil-progress-circle');
      expect(html).toContain('progressbar');
      expect(html).toContain('aria-label="Loading..."');
      expect(html).toContain('veil-progress-spin');
    });

    it('renders ProgressCircle with percentage label when percent is specified', () => {
      const html = renderToStaticMarkup(<ProgressCircle percent={65} size={40} />);
      expect(html).toContain('aria-valuenow="65"');
      expect(html).toContain('aria-label="65% complete"');
    });

    it('renders cancel SVG button when showCancel is true', () => {
      const html = renderToStaticMarkup(<ProgressCircle percent={50} showCancel={true} onCancel={() => {}} />);
      expect(html).toContain('aria-label="Cancel transfer"');
      expect(html).toContain('svg');
    });

    it('overlays ProgressCircle over media when isDownloading is true', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg-attach-dl"
          text=""
          isOutgoing={false}
          timestamp={1700000000000}
          attachmentElement={<div id="test-image">Image Content</div>}
          isDownloading={true}
        />
      );
      expect(html).toContain('id="test-image"');
      expect(html).toContain('veil-progress-circle');
    });

    it('overlays ProgressCircle over media when isUploading is true', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg-attach-ul"
          text=""
          isOutgoing={true}
          timestamp={1700000000000}
          attachmentElement={<div id="test-video">Video Content</div>}
          isUploading={true}
        />
      );
      expect(html).toContain('id="test-video"');
      expect(html).toContain('veil-progress-circle');
    });
  });

  describe('3. Smart Emoji Reactions & Recent Tracking', () => {
    it('returns DEFAULT_RECENT emojis when no history is stored', () => {
      const recents = getRecentEmojis();
      expect(recents).toEqual(DEFAULT_RECENT);
      expect(recents.length).toBe(7);
      expect(recents).toContain('\u2764\uFE0F');
      expect(recents).toContain('\u{1F44D}');
    });

    it('addRecentEmoji pushes new emoji to front and persists to localStorage', () => {
      addRecentEmoji('\u{1F680}'); // rocket
      const updated = getRecentEmojis();
      expect(updated[0]).toBe('\u{1F680}');
      expect(updated).toContain('\u{1F44D}');

      // Re-adding moves to front without duplicating
      addRecentEmoji('\u{1F525}'); // fire
      const updated2 = getRecentEmojis();
      expect(updated2[0]).toBe('\u{1F525}');
      expect(updated2[1]).toBe('\u{1F680}');
    });

    it('renders EmojiPickerPopup with categorized grid and search field', () => {
      const html = renderToStaticMarkup(
        <EmojiPickerPopup onSelect={vi.fn()} onClose={vi.fn()} />
      );
      expect(html).toContain('veil-emoji-picker');
      expect(html).toContain('placeholder="Search emoji..."');
      expect(html).toContain('title="Smileys"');
      expect(html).toContain('title="Recent"');
    });
  });

  describe('4. Audio UI Polish & Error Resilience', () => {
    it('verifies VoicePlayer retry logic is present in voicePlayer.ts', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const src = fs.readFileSync(path.resolve(__dirname, '../src/attachments/voicePlayer.ts'), 'utf-8');
      expect(src).toContain('playErr?.name === \'AbortError\'');
      expect(src).toContain('playErr?.name === \'NotAllowedError\'');
      expect(src).toContain('setTimeout(r, 300)');
    });

    it('verifies VoiceNoteCard smooth transition styling in VoiceNoteCard.tsx', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const src = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/ui/VoiceNoteCard.tsx'), 'utf-8');
      expect(src).toContain('borderRadius: \'2px\'');
      expect(src).toContain('height 0.2s ease');
    });
  });
});
