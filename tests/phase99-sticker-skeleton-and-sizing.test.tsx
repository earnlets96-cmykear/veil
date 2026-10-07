import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 99: Sticker Loading & Compact Sizing', () => {
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

    it('uses the shared sticker image loader with a skeleton and an explicit unavailable state', () => {
      const imageContent = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/stickers/StickerImage.tsx'), 'utf-8');
      expect(drawerContent).toContain('const StickerGridCell');
      expect(drawerContent).toContain('<StickerImage');
      expect(imageContent).toContain('veil-sticker-skeleton');
      expect(imageContent).toContain('veil-sticker-image-unavailable');
    });

    it('does not create a timed retry loop for failed sticker images', () => {
      expect(drawerContent).not.toContain('setRetryKey((k) => k + 1)');
      expect(drawerContent).not.toContain('setTimeout(attemptStickerRecovery, 1000)');
    });

    it('loads sticker pack thumbnails through the shared loader', () => {
      expect(drawerContent).toContain('const StickerPackTabButton');
      expect(drawerContent).toContain('className="veil-sticker-pack-image"');
      expect(drawerContent).toContain('imageClassName="veil-sticker-pack-thumb"');
    });

    it('preserves an accessible label for sticker images', () => {
      expect(drawerContent).toContain('alt={sticker.emoji || \'Sticker\'}');
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

    it('uses strict sticker recovery and stops in a visible unavailable state', () => {
      expect(mediaImageContent).toContain('fetchStickerBlob(sourceUrl, { allowSyntheticFallback: false })');
      expect(mediaImageContent).toContain("setError('Sticker unavailable')");
      expect(mediaImageContent).not.toContain('stickerRetryTimerRef.current = setTimeout(attemptStickerRecovery, 1000)');
    });
  });

  describe('4. telegramStickerService On-Demand Loading', () => {
    const servicePath = path.resolve(__dirname, '../src/media/telegramStickerService.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');

    it('avoids eager retries that cache decorative fallbacks as real stickers', () => {
      expect(serviceContent).toContain('Load sticker bytes on demand from the UI');
      expect(serviceContent).not.toContain('retriesLeft > 0');
      expect(serviceContent).toContain('allowSyntheticFallback');
    });
  });
});
