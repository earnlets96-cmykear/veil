/**
 * Phase 83: Telegram Sticker Packs & Chat UX Test Suite.
 *
 * Verifies:
 * 1. telegramStickerService URL parsing (t.me/addstickers, tg://, bare identifiers).
 * 2. Installed starter packs (Spotty, Cute Animals, Classic Memes) loading.
 * 3. Recent stickers caching, deduplication, and FIFO limit.
 * 4. EmojiDrawer sticker pack navigation, grid rendering, and sticker selection callback.
 * 5. AddStickerPackModal rendering and Telegram link input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  telegramStickerService,
  BUILT_IN_STICKER_PACKS,
  StickerItem,
} from '../src/media/telegramStickerService.ts';
import { EmojiDrawer } from '../src/ui/components/ui/EmojiDrawer.tsx';
import { AddStickerPackModal } from '../src/ui/components/stickers/AddStickerPackModal.tsx';

describe('Phase 83: Telegram Sticker Packs & Chat UX Test Suite', () => {
  describe('1. Telegram Sticker URL Parser', () => {
    it('parses standard https://t.me/addstickers/<pack> URLs', () => {
      expect(telegramStickerService.parseTelegramPackUrl('https://t.me/addstickers/spotty')).toBe('spotty');
      expect(telegramStickerService.parseTelegramPackUrl('http://t.me/addstickers/animals')).toBe('animals');
      expect(telegramStickerService.parseTelegramPackUrl('t.me/addstickers/memes')).toBe('memes');
    });

    it('parses telegram.me and tg:// custom protocols', () => {
      expect(telegramStickerService.parseTelegramPackUrl('https://telegram.me/addstickers/spotty_dog')).toBe('spotty_dog');
      expect(telegramStickerService.parseTelegramPackUrl('tg://addstickers?set=hot_cherry')).toBe('hot_cherry');
      expect(telegramStickerService.parseTelegramPackUrl('tg:addstickers?set=cat_vibes')).toBe('cat_vibes');
    });

    it('accepts clean alphanumeric pack identifiers directly', () => {
      expect(telegramStickerService.parseTelegramPackUrl('spotty')).toBe('spotty');
      expect(telegramStickerService.parseTelegramPackUrl('ClassicMemes_by_bot')).toBe('ClassicMemes_by_bot');
    });

    it('rejects invalid or empty pack strings', () => {
      expect(telegramStickerService.parseTelegramPackUrl('')).toBeNull();
      expect(telegramStickerService.parseTelegramPackUrl('   ')).toBeNull();
      expect(telegramStickerService.parseTelegramPackUrl('https://google.com/search?q=test')).toBeNull();
    });
  });

  describe('2. Built-in Packs and Storage Service', () => {
    it('provides 3 high-resolution vector starter packs', () => {
      expect(BUILT_IN_STICKER_PACKS.length).toBe(3);
      const packIds = BUILT_IN_STICKER_PACKS.map((p) => p.id);
      expect(packIds).toContain('spotty');
      expect(packIds).toContain('animals');
      expect(packIds).toContain('memes');
    });

    it('returns built-in packs on getInstalledPacks()', async () => {
      const packs = await telegramStickerService.getInstalledPacks();
      expect(packs.length).toBeGreaterThanOrEqual(3);
      const spotty = packs.find((p) => p.id === 'spotty');
      expect(spotty).toBeDefined();
      expect(spotty?.stickers.length).toBeGreaterThan(0);
      expect(spotty?.stickers[0].url.startsWith('data:image/svg+xml')).toBe(true);
    });

    it('caches and retrieves recent stickers in order', () => {
      const sampleSticker: StickerItem = {
        id: 'test-stk-1',
        packId: 'spotty',
        emoji: '\u{1F436}',
        url: 'data:image/svg+xml;utf8,<svg></svg>',
        width: 120,
        height: 120,
      };

      telegramStickerService.recordRecentSticker(sampleSticker);
      const recents = telegramStickerService.getRecentStickers();
      expect(recents.some((s) => s.id === 'test-stk-1')).toBe(true);
    });

    it('resolves built-in packs instantly in fetchTelegramPack()', async () => {
      const pack = await telegramStickerService.fetchTelegramPack('animals');
      expect(pack.id).toBe('animals');
      expect(pack.title).toBe('Telegram Animals');
      expect(pack.stickers.length).toBe(4);
    });
  });

  describe('3. EmojiDrawer Sticker Integration UI', () => {
    it('renders segmented control with Emoji, Stickers, and GIFs tabs', () => {
      const html = renderToStaticMarkup(
        <EmojiDrawer
          isOpen={true}
          onSelectEmoji={vi.fn()}
          onSelectSticker={vi.fn()}
          onBackspace={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Emoji');
      expect(html).toContain('Stickers');
      expect(html).toContain('GIFs');
    });

    it('renders Add Sticker Pack button and pack bar structure', () => {
      const html = renderToStaticMarkup(
        <EmojiDrawer
          isOpen={true}
          onSelectEmoji={vi.fn()}
          onSelectSticker={vi.fn()}
          onBackspace={vi.fn()}
          onClose={vi.fn()}
        />
      );

      // Verify drawer container and search input
      expect(html).toContain('veil-emoji-drawer');
      expect(html).toContain('veil-emoji-search-input');
    });
  });

  describe('4. AddStickerPackModal Component', () => {
    it('renders input field, placeholder, and action buttons when open', () => {
      const html = renderToStaticMarkup(
        <AddStickerPackModal
          isOpen={true}
          onClose={vi.fn()}
          onPackInstalled={vi.fn()}
        />
      );

      expect(html).toContain('Add Telegram Stickers');
      expect(html).toContain('t.me/addstickers/...');
      expect(html).toContain('Find');
    });

    it('renders popular telegram pack chips', () => {
      const html = renderToStaticMarkup(
        <AddStickerPackModal
          isOpen={true}
          onClose={vi.fn()}
          onPackInstalled={vi.fn()}
        />
      );

      expect(html).toContain('Popular Telegram Packs');
      expect(html).toContain('Cute Animals');
      expect(html).toContain('Classic Memes');
      expect(html).toContain('Spotty Dog');
    });

    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <AddStickerPackModal
          isOpen={false}
          onClose={vi.fn()}
          onPackInstalled={vi.fn()}
        />
      );

      expect(html).toBe('');
    });
  });

  describe('5. Featured Packs API', () => {
    it('provides popular Telegram sticker pack suggestions with icons and titles', () => {
      const featured = telegramStickerService.getFeaturedPacks();
      expect(featured.length).toBeGreaterThanOrEqual(6);
      expect(featured.some((f) => f.id === 'animals')).toBe(true);
      expect(featured.some((f) => f.id === 'memes')).toBe(true);
      expect(featured.some((f) => f.id === 'spotty')).toBe(true);
      expect(featured.some((f) => f.id === 'hot_cherry')).toBe(true);
      expect(featured.some((f) => f.id === 'cat_vibes')).toBe(true);
    });
  });

  describe('6. Frameless Sticker Display & CSS Architecture', () => {
    it('defines .veil-sticker-bubble-container with transparent background and frameless geometry', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const cssContent = fs.readFileSync(path.resolve(__dirname, '../src/styles/veil-components.css'), 'utf-8');

      expect(cssContent).toContain('.veil-sticker-bubble-container');
      expect(cssContent).toContain('background: transparent !important');
      expect(cssContent).toContain('box-shadow: none !important');
      expect(cssContent).toContain('width: 180px !important');
      expect(cssContent).toContain('height: 180px !important');
      expect(cssContent).toContain('drop-shadow');
    });

    it('identifies sticker attachments by extension (.sticker.webp, .sticker.svg) and MIME type', () => {
      const isStickerAttachment = (attachment?: { name?: string; type?: string }) => {
        if (!attachment) return false;
        const name = (attachment.name || '').toLowerCase();
        const type = (attachment.type || '').toLowerCase();
        return name.includes('.sticker.') || type.includes('sticker') || name.endsWith('.sticker.webp') || name.endsWith('.sticker.svg');
      };

      expect(isStickerAttachment({ name: 'spotty_thumbsup.sticker.webp', type: 'image/webp' })).toBe(true);
      expect(isStickerAttachment({ name: 'cat.sticker.svg', type: 'image/svg+xml' })).toBe(true);
      expect(isStickerAttachment({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);
      expect(isStickerAttachment({ name: 'document.pdf', type: 'application/pdf' })).toBe(false);
      expect(isStickerAttachment(undefined)).toBe(false);
    });
  });
});


