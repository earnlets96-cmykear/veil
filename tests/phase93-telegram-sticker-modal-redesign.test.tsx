/**
 * Phase 93 Test Suite: Telegram Sticker Pack Modal Redesign & Direct In-Chat Usage
 *
 * Verifies:
 * 1. AddStickerPackModal View Redesign:
 *    - Uses ReactDOM.createPortal to mount to document.body, escaping drawer clipping.
 *    - Renders all stickers in previewPack without slice(0, 24) artificial limits.
 *    - Uses dedicated .veil-add-sticker-preview-grid-wrap scroll container.
 *    - Has sticky footer (.veil-add-sticker-sticky-footer) with prominent install button.
 *    - Header features back navigation to search another pack and sticker count badge.
 * 2. Reliable Sticker Image Dispatch (CORS & Proxy):
 *    - telegramStickerService defines fetchStickerBlob with direct and proxy fallbacks.
 *    - MessageComposer handleSelectSticker uses fetchStickerBlob to prevent CORS silent failure.
 *    - vite.config.ts and relayServer.ts implement /api/telegram-stickers/proxy and /v1/stickers/proxy.
 * 3. EmojiDrawer Integration:
 *    - onPackInstalled switches activeTab to 'stickers' and sets activePackId to the newly installed pack.
 * 4. Phase 44a Zero Literal Unicode Emoji Compliance across all touched source and test files.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { telegramStickerService } from '../src/media/telegramStickerService.ts';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 93: AddStickerPackModal View Redesign & Portalling', () => {
  const modalSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/stickers/AddStickerPackModal.tsx'),
    'utf-8'
  );

  it('ports modal directly to document.body via createPortal to prevent drawer overflow clipping', () => {
    expect(modalSource).toContain("import { createPortal } from 'react-dom';");
    expect(modalSource).toContain('createPortal(modalContent, document.body)');
  });

  it('renders all stickers in the pack without slice(0, 24) truncation', () => {
    expect(modalSource).not.toContain('previewPack.stickers.slice(0, 24)');
    expect(modalSource).toContain('previewPack.stickers.map((stk: StickerItem, idx: number)');
  });

  it('implements scrollable preview grid wrapper with custom scrollbar styles', () => {
    expect(modalSource).toContain('className="veil-add-sticker-preview-grid-wrap"');
    expect(modalSource).toContain('className="veil-add-sticker-preview-grid"');
  });

  it('features sticky action footer with permanent full-width CTA button', () => {
    expect(modalSource).toContain('className="veil-add-sticker-sticky-footer"');
    expect(modalSource).toMatch(/className=\{`veil-add-sticker-install-btn/);
    expect(modalSource).toContain('Add ${previewPack.stickers.length} Stickers to VEIL');
  });

  it('includes navigation back button to return from preview to pack search', () => {
    expect(modalSource).toContain('className="veil-add-sticker-back-btn"');
    expect(modalSource).toContain('onClick={() => setPreviewPack(null)}');
    expect(modalSource).toContain('ArrowLeftIcon');
  });
});

describe('Phase 93: Reliable Sticker Blob Dispatching & Proxy Support', () => {
  const stickerServiceSource = fs.readFileSync(
    path.join(rootDir, 'src/media/telegramStickerService.ts'),
    'utf-8'
  );
  const composerSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/MessageComposer.tsx'),
    'utf-8'
  );
  const viteConfigSource = fs.readFileSync(
    path.join(rootDir, 'vite.config.ts'),
    'utf-8'
  );
  const relaySource = fs.readFileSync(
    path.join(rootDir, 'src/server/relayServer.ts'),
    'utf-8'
  );

  it('telegramStickerService implements fetchStickerBlob with direct, data, and proxy fallbacks', () => {
    expect(stickerServiceSource).toContain('async fetchStickerBlob(url: string): Promise<Blob>');
    expect(stickerServiceSource).toContain("url.startsWith('data:')");
    expect(stickerServiceSource).toContain('/api/telegram-stickers/proxy?url=');
    expect(stickerServiceSource).toContain('/v1/stickers/proxy?url=');
  });

  it('fetchStickerBlob successfully resolves data:image/svg+xml into binary Blob', async () => {
    const testSvgData = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg><circle r="10"/></svg>');
    const blob = await telegramStickerService.fetchStickerBlob(testSvgData);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('MessageComposer handleSelectSticker uses telegramStickerService.fetchStickerBlob', () => {
    expect(composerSource).toContain('import { StickerItem, telegramStickerService }');
    expect(composerSource).toContain('const blob = await telegramStickerService.fetchStickerBlob(sticker.url);');
  });

  it('vite.config.ts and relayServer.ts provide /api/telegram-stickers/proxy endpoint with CORS headers', () => {
    expect(viteConfigSource).toContain("url.startsWith('/api/telegram-stickers/proxy?url=')");
    expect(viteConfigSource).toContain("res.setHeader('Access-Control-Allow-Origin', '*')");

    expect(relaySource).toContain("url.startsWith('/v1/stickers/proxy?url=')");
    expect(relaySource).toContain("res.setHeader('Access-Control-Allow-Origin', '*')");
  });
});

describe('Phase 93: EmojiDrawer State Sync & Navigation', () => {
  const drawerSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ui/EmojiDrawer.tsx'),
    'utf-8'
  );

  it('switches to stickers tab and activates newly installed pack in onPackInstalled', () => {
    expect(drawerSource).toContain("setActiveTab('stickers');");
    expect(drawerSource).toContain('setActivePackId(newPack.id);');
  });
});

describe('Phase 93: CSS Stylesheet Completeness & Design Standards', () => {
  const cssSource = fs.readFileSync(
    path.join(rootDir, 'src/styles/veil-components.css'),
    'utf-8'
  );

  it('defines fixed full-screen backdrop and glassmorphic dialog container', () => {
    expect(cssSource).toMatch(/\.veil-add-sticker-backdrop\s*\{[^}]*position:\s*fixed/);
    expect(cssSource).toMatch(/\.veil-add-sticker-backdrop\s*\{[^}]*z-index:\s*1200/);
    expect(cssSource).toMatch(/\.veil-add-sticker-modal\s*\{[^}]*border-radius:\s*20px/);
  });

  it('defines scrollable preview grid wrapper and sticky action footer styles', () => {
    expect(cssSource).toMatch(/\.veil-add-sticker-preview-grid-wrap\s*\{[^}]*overflow-y:\s*auto/);
    expect(cssSource).toMatch(/\.veil-add-sticker-sticky-footer\s*\{[^}]*border-top:/);
    expect(cssSource).toMatch(/\.veil-add-sticker-install-btn\s*\{[^}]*background:/);
  });
});

describe('Phase 93: Strict Phase 44a Zero Literal Unicode Emoji Compliance', () => {
  const touchedFiles = [
    'src/ui/components/stickers/AddStickerPackModal.tsx',
    'src/ui/components/MessageComposer.tsx',
    'src/ui/components/ui/EmojiDrawer.tsx',
    'src/media/telegramStickerService.ts',
    'src/server/relayServer.ts',
    'vite.config.ts',
    'src/styles/veil-components.css',
    'tests/phase93-telegram-sticker-modal-redesign.test.tsx',
  ];

  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  for (const relPath of touchedFiles) {
    it(`ensures ${relPath} contains zero literal unicode emojis`, () => {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const match = line.match(emojiRegex);
        if (match) {
          throw new Error(
            `Phase 44a Violation: Literal unicode emoji "${match[0]}" found in ${relPath}:${idx + 1}: ${line}`
          );
        }
      });
    });
  }
});
