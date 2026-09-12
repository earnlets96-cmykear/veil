import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 99: Sticker Skeleton Loaders, 1s Auto-Refresh & Compact Sizing', () => {
  describe('1. CSS Sizing & Layout Verification', () => {
    const cssPath = path.resolve(__dirname, '../src/styles/veil-components.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    it('defines compact 5-column grid with reduced gap in the sticker drawer', () => {
      expect(cssContent).toContain('grid-template-columns: repeat(5, 1fr);');
      expect(cssContent).toContain('gap: 6px;');
      expect(cssContent).toContain('padding: 6px 10px 20px 10px;');
    });

    it('defines compact cell padding and skeleton loader styling', () => {
      expect(cssContent).toContain('.veil-sticker-cell');
      expect(cssContent).toContain('padding: 3px;');
      expect(cssContent).toContain('.veil-sticker-skeleton');
      expect(cssContent).toContain('animation: veilSkeletonPulse 1.4s ease infinite;');
    });

    it('reduces chat sticker dimensions from 180px to 136px for natural message proportions', () => {
      expect(cssContent).toContain('width: 136px !important;');
      expect(cssContent).toContain('height: 136px !important;');
      expect(cssContent).toContain('max-width: 136px !important;');
      expect(cssContent).toContain('max-height: 136px !important;');
    });
  });

  describe('2. EmojiDrawer Self-Healing & Skeleton Logic', () => {
    const drawerPath = path.resolve(__dirname, '../src/ui/components/ui/EmojiDrawer.tsx');
    const drawerContent = fs.readFileSync(drawerPath, 'utf-8');

    it('renders StickerGridCell with veil-sticker-skeleton while loading or in error', () => {
      expect(drawerContent).toContain('const StickerGridCell');
      expect(drawerContent).toContain('loadStatus !== \'loaded\' && <div className="veil-sticker-skeleton" />');
      expect(drawerContent).toContain('display: loadStatus === \'loaded\' ? \'block\' : \'none\'');
    });

    it('implements 1-second auto-retry on sticker image failure in StickerGridCell', () => {
      expect(drawerContent).toContain('if (loadStatus === \'error\')');
      expect(drawerContent).toContain('telegramStickerService.fetchStickerBlob(sticker.url)');
      expect(drawerContent).toContain('1000');
    });

    it('renders StickerPackTabButton with mini skeleton and 1-second auto-refresh', () => {
      expect(drawerContent).toContain('const StickerPackTabButton');
      expect(drawerContent).toContain('style={{ width: \'22px\', height: \'22px\', borderRadius: \'4px\' }}');
      expect(drawerContent).toContain('telegramStickerService.fetchStickerBlob(pack.thumbnailUrl)');
    });

    it('clears alt attribute text on sticker image to prevent broken text display', () => {
      // alt="" prevents browser from painting ugly text alongside broken image icons
      expect(drawerContent).toContain('alt=""');
    });
  });

  describe('3. MediaImage Sticker Error Recovery & Alt Suppression', () => {
    const mediaImagePath = path.resolve(__dirname, '../src/ui/components/media/MediaImage.tsx');
    const mediaImageContent = fs.readFileSync(mediaImagePath, 'utf-8');

    it('detects isSticker and renders skeleton pulse on error instead of broken image', () => {
      expect(mediaImageContent).toContain('const isSticker = Boolean');
      expect(mediaImageContent).toContain('if (error && !displayUrl)');
      expect(mediaImageContent).toContain('if (isSticker)');
      expect(mediaImageContent).toContain('veil-media-skeleton-pulse');
    });

    it('suppresses raw attachment filename in alt text for sticker messages', () => {
      expect(mediaImageContent).toContain('alt={isSticker ? \'\' : (alt || attachment.name)}');
    });

    it('implements 1-second auto-recovery loop on broken sticker blob', () => {
      expect(mediaImageContent).toContain('telegramStickerService.fetchStickerBlob(sourceUrl)');
      expect(mediaImageContent).toContain('stickerRetryTimerRef.current = setTimeout(attemptStickerRecovery, 1000)');
    });
  });

  describe('4. telegramStickerService Pre-Cache Continuous Retry', () => {
    const servicePath = path.resolve(__dirname, '../src/media/telegramStickerService.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');

    it('includes 1-second auto-retry on background pre-cache failure', () => {
      expect(serviceContent).toContain('// Pre-cache stickers in background with 1-second auto-retry on failure');
      expect(serviceContent).toContain('retriesLeft > 0');
      expect(serviceContent).toContain('1000');
    });
  });
});
