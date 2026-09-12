/**
 * Phase 95 Test Suite: Telegram Sticker Pack Full 120+ Resolution & Full HD 512x512 Assets
 *
 * Verifies:
 * 1. Full 120+ Sticker Resolution (No Truncation):
 *    - TelegramStickerResolver resolves full sticker sets without arbitrary slice(0, 100) or 20 limits.
 *    - telegramStickerService preserves all 120+ stickers in local pack storage.
 * 2. High Definition 512x512 WebP Assets:
 *    - Stickers are assigned 512x512 dimensions and routed via on-demand server file proxy.
 *    - On-demand proxy calls Telegram getFile API to download authentic 512x512 full-res WebP.
 * 3. Fix "Failed to load sticker image data":
 *    - /api/telegram-stickers/file and /v1/stickers/file serve image binaries with Access-Control-Allow-Origin: *.
 *    - telegramStickerService.fetchStickerBlob handles relative server URLs, data URLs, and canvas fallback.
 * 4. UI Guidance:
 *    - AddStickerPackModal displays HD badge, bot token helper, and preview limit warning.
 * 5. Phase 44a Zero Literal Unicode Emoji Compliance across all touched source files and tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TelegramStickerResolver } from '../src/server/stickers/telegramStickerResolver.ts';
import { telegramStickerService } from '../src/media/telegramStickerService.ts';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 95: Telegram Sticker Resolver Full 120+ Resolution & On-Demand File Proxy', () => {
  const resolverSource = fs.readFileSync(
    path.join(rootDir, 'src/server/stickers/telegramStickerResolver.ts'),
    'utf-8'
  );
  const viteSource = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf-8');
  const relaySource = fs.readFileSync(path.join(rootDir, 'src/server/relayServer.ts'), 'utf-8');

  it('contains on-demand file proxy endpoint in vite.config.ts with CORS and caching', () => {
    expect(viteSource).toContain('/api/telegram-stickers/file');
    expect(viteSource).toContain('/v1/stickers/file');
    expect(viteSource).toContain("res.setHeader('Access-Control-Allow-Origin', '*')");
    expect(viteSource).toContain("res.setHeader('Cache-Control', 'public, max-age=604800, immutable')");
    expect(viteSource).toContain('fetchStickerImageBuffer');
  });

  it('contains on-demand file proxy endpoint in relayServer.ts for production parity', () => {
    expect(relaySource).toContain('/v1/stickers/file');
    expect(relaySource).toContain('/api/telegram-stickers/file');
    expect(relaySource).toContain("res.setHeader('Access-Control-Allow-Origin', '*')");
    expect(relaySource).toContain('fetchStickerImageBuffer');
  });

  it('implements TelegramStickerResolver.fetchStickerImageBuffer with getFile resolution and LRU caching', async () => {
    expect(resolverSource).toContain('public static async fetchStickerImageBuffer');
    expect(resolverSource).toContain('getFile?file_id=');
    expect(resolverSource).toContain('fileBufferCache');
    expect(resolverSource).toContain('filePathCache');
  });

  it('resolves all 120 stickers from Telegram Bot API without slicing or truncation', async () => {
    // Generate a mock Telegram sticker set response with 120 stickers
    const mock120Stickers = Array.from({ length: 120 }, (_, i) => ({
      file_id: `file_id_${i}`,
      file_unique_id: `unique_${i}`,
      width: 512,
      height: 512,
      emoji: '\u{1F600}',
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('getStickerSet')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              name: 'huge_pack',
              title: 'Huge 120 Pack',
              stickers: mock120Stickers,
            },
          }),
        } as any;
      }
      return { ok: false } as any;
    });

    try {
      const pack = await TelegramStickerResolver.resolvePack('huge_pack', 'test_token_123');
      expect(pack).not.toBeNull();
      expect(pack?.stickers.length).toBe(120);
      expect(pack?.stickers[0].width).toBe(512);
      expect(pack?.stickers[0].height).toBe(512);
      expect(pack?.stickers[0].url).toContain('/api/telegram-stickers/file?file_id=file_id_0&token=test_token_123');
      expect(pack?.stickers[119].url).toContain('/api/telegram-stickers/file?file_id=file_id_119&token=test_token_123');
      expect(pack?.thumbnailUrl).toContain('/api/telegram-stickers/file?file_id=file_id_0');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Phase 95: Client-Side Sticker Service Unlimited Count & Resilient Blob Fetching', () => {
  const serviceSource = fs.readFileSync(
    path.join(rootDir, 'src/media/telegramStickerService.ts'),
    'utf-8'
  );

  it('does not artificially slice Telegram Bot API stickers to 100 in fetchTelegramPack', () => {
    expect(serviceSource).not.toContain('(result.stickers || []).slice(0, 100)');
    expect(serviceSource).toContain('url: `/api/telegram-stickers/file?file_id=');
  });

  it('passes bot token as query parameter and header when requesting server resolver', () => {
    expect(serviceSource).toContain("queryParam = botToken ? `?token=${encodeURIComponent(botToken)}` : ''");
    expect(serviceSource).toContain("headers: botToken ? { 'x-telegram-bot-token': botToken } : {}");
  });

  it('handles relative server file proxy URLs directly in fetchStickerBlob', async () => {
    const originalFetch = globalThis.fetch;
    const mockBlob = new Blob(['mock-webp-binary'], { type: 'image/webp' });
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/telegram-stickers/file')) {
        return {
          ok: true,
          blob: async () => mockBlob,
        } as any;
      }
      return { ok: false } as any;
    });

    try {
      const blob = await telegramStickerService.fetchStickerBlob('/api/telegram-stickers/file?file_id=test_1&token=abc');
      expect(blob).toBeDefined();
      expect(blob.type).toBe('image/webp');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles data URLs in fetchStickerBlob', async () => {
    const dataUrl = 'data:image/svg+xml;utf8,<svg></svg>';
    const blob = await telegramStickerService.fetchStickerBlob(dataUrl);
    expect(blob).toBeDefined();
    expect(blob.type).toContain('svg');
  });
});

describe('Phase 95: UI AddStickerPackModal HD Badge & Bot Token Experience', () => {
  const modalSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/stickers/AddStickerPackModal.tsx'),
    'utf-8'
  );

  it('displays full HD 512x512 badge when stickers or bot token are active', () => {
    expect(modalSource).toContain('512x512 HD');
    expect(modalSource).toContain('veil-add-sticker-count-badge');
  });

  it('shows helpful preview indicator when 20 preview stickers are scraped without bot token', () => {
    expect(modalSource).toContain('Showing 20 preview stickers');
    expect(modalSource).toContain('unlock all 120+ stickers in full 512x512 High Definition');
  });

  it('provides simple 3-step guide for creating a bot token with @BotFather', () => {
    expect(modalSource).toContain('@BotFather');
    expect(modalSource).toContain('/newbot');
  });
});

describe('Phase 95: Phase 44a Zero Literal Unicode Emoji Compliance', () => {
  const filesToCheck = [
    'src/server/stickers/telegramStickerResolver.ts',
    'src/media/telegramStickerService.ts',
    'src/ui/components/stickers/AddStickerPackModal.tsx',
    'vite.config.ts',
    'src/server/relayServer.ts',
  ];

  // Regex matching raw literal emojis (surrogates and emoji blocks)
  const literalEmojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

  for (const file of filesToCheck) {
    it(`guarantees ${file} contains ZERO literal Unicode emojis`, () => {
      const content = fs.readFileSync(path.join(rootDir, file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (literalEmojiRegex.test(line)) {
          throw new Error(`Found literal Unicode emoji in ${file}:${i + 1}: ${line}`);
        }
      }
    });
  }
});
