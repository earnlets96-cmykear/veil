import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Phase 109: sticker loading and touch gesture boundaries', () => {
  it('uses the same proxy-backed sticker image loader in both sticker surfaces', () => {
    const modal = read('src/ui/components/stickers/AddStickerPackModal.tsx');
    const drawer = read('src/ui/components/ui/EmojiDrawer.tsx');

    expect(modal).toContain('<StickerImage');
    expect(drawer).toContain('<StickerImage');
  });

  it('supports strict sticker fetches so failed network loads do not become fake star stickers', () => {
    const service = read('src/media/telegramStickerService.ts');

    expect(service).toContain('allowSyntheticFallback');
    expect(service).toContain('Sticker image could not be loaded');
  });

  it('does not retry failed sticker images forever or keep them in a loading skeleton', () => {
    const drawer = read('src/ui/components/ui/EmojiDrawer.tsx');

    expect(drawer).toContain('StickerImage');
    expect(drawer).not.toContain('setRetryKey((k) => k + 1)');
  });

  it('opens message actions from a deliberate context gesture, not a regular tap', () => {
    const conversation = read('src/ui/components/ConversationView.tsx');
    const rowClick = conversation.match(
      /className=\{`veil-msg-row[\s\S]*?onClick=\{\(e\) => \{([\s\S]*?)\}\}\s*onContextMenu=/
    )?.[1] || '';

    expect(rowClick).not.toContain('onContextMenu(e, msg)');
  });

  it('cancels a pending long press as soon as the finger moves to scroll or swipe', () => {
    const conversation = read('src/ui/components/ConversationView.tsx');

    expect(conversation).toContain('TOUCH_GESTURE_CANCEL_THRESHOLD_PX');
    expect(conversation).toContain('cancelLongPress');
  });

  it('lets the voice card swipe to reply while keeping waveform seeking isolated', () => {
    const conversation = read('src/ui/components/ConversationView.tsx');
    const voiceCard = read('src/ui/components/ui/VoiceNoteCard.tsx');
    const touchStart = conversation.match(/const handleTouchStart = \(e: React\.TouchEvent\) => \{([\s\S]*?)\n  \};/)?.[1] || '';

    expect(touchStart).not.toContain('.veil-voicenote-card');
    expect(voiceCard).toMatch(/className=\{`veil-voicenote-card[^\n]*\n\s*data-voice-swipe-surface="true"/);
    expect(voiceCard).toContain('className="veil-waveform-container"');
    expect(voiceCard).toContain('data-no-swipe="true"');
  });

  it('gives the emoji and sticker drawer more usable vertical space on phones', () => {
    const css = read('src/styles/veil-components.css');

    expect(css).toContain('height: min(400px, 52dvh)');
    expect(css).toContain('max-height: min(400px, 52dvh)');
  });
});
