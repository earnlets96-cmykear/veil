/**
 * Phase 97: Sticker Dispatch Reliability, Multi-Tier Proxying, and Fallback Synthesis
 *
 * Verifies:
 * 1. fetchStickerBlob handles data URLs, relative endpoints, and multi-tier proxies.
 * 2. fetchStickerBlob NEVER throws, synthesizing an SVG fallback blob when all upstream/proxy sources are unreachable.
 * 3. extractEmojiFromUrl decodes hex-encoded Telegram/Combot emoji filenames.
 * 4. AddStickerPackModal backdrop adheres to modal outside-dismiss contract (className="veil-modal-backdrop").
 * 5. Phase 44a Zero Literal Unicode Emoji Compliance across all touched source files.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { telegramStickerService, StickerPack, StickerItem } from '../src/media/telegramStickerService.ts';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 97: Sticker Dispatch Reliability & Fallback Synthesis', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('1. fetchStickerBlob resolves data URLs immediately without external network requests', async () => {
    const svgData = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg><circle cx="10" cy="10" r="5"/></svg>');
    const blob = await telegramStickerService.fetchStickerBlob(svgData);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('image/svg+xml');
  });

  it('2. fetchStickerBlob resolves relative endpoints with in-memory caching', async () => {
    const mockWebpBytes = new Uint8Array([82, 73, 70, 70, 20, 0, 0, 0, 87, 69, 66, 80]);
    let fetchCount = 0;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      fetchCount++;
      const urlStr = String(input);
      if (urlStr.startsWith('/api/telegram-stickers/file')) {
        return new Response(mockWebpBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/webp' },
        });
      }
      return new Response('Not Found', { status: 404 });
    }) as any;

    const testUrl = '/api/telegram-stickers/file?file_id=phase97_test_01&token=mock';
    const blob1 = await telegramStickerService.fetchStickerBlob(testUrl);

    expect(blob1).toBeInstanceOf(Blob);
    expect(blob1.size).toBe(mockWebpBytes.length);
    expect(fetchCount).toBe(1);

    // Second call should hit in-memory blob cache
    const blob2 = await telegramStickerService.fetchStickerBlob(testUrl);
    expect(blob2).toBeInstanceOf(Blob);
    expect(fetchCount).toBe(1); // No new network request
  });

  it('3. fetchStickerBlob attempts multi-tier proxies when direct CDN fetch fails CORS', async () => {
    const mockStickerData = new Uint8Array([1, 2, 3, 4, 5]);
    const fetchedUrls: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      fetchedUrls.push(urlStr);

      // Direct CDN fetch fails (CORS error simulation)
      if (urlStr.startsWith('https://cdn.combot.online/')) {
        throw new TypeError('Failed to fetch (CORS header missing)');
      }

      // Proxy endpoint succeeds
      if (urlStr.startsWith('/api/telegram-stickers/proxy?url=') || urlStr.startsWith('/v1/stickers/proxy?url=')) {
        return new Response(mockStickerData, {
          status: 200,
          headers: { 'Content-Type': 'image/webp' },
        });
      }

      return new Response('Error', { status: 500 });
    }) as any;

    const cdnUrl = 'https://cdn.combot.online/companyxd_by_fstikbot/webp/0xf09f8c9f.webp';
    const blob = await telegramStickerService.fetchStickerBlob(cdnUrl);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(mockStickerData.length);
    expect(fetchedUrls.some((u) => u.includes('/proxy?url='))).toBe(true);
  });

  it('4. fetchStickerBlob NEVER throws when all network and proxies fail, returning SVG fallback blob', async () => {
    // Simulate total network failure / offline mode
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network offline');
    }) as any;

    const cdnUrl = 'https://cdn.combot.online/offline_pack/webp/0xf09f9883.webp';
    let caughtError: any = null;
    let blob: Blob | null = null;

    try {
      blob = await telegramStickerService.fetchStickerBlob(cdnUrl);
    } catch (err) {
      caughtError = err;
    }

    // Must NEVER throw an error
    expect(caughtError).toBeNull();
    expect(blob).not.toBeNull();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.size).toBeGreaterThan(0);
    expect(blob!.type).toContain('image/svg+xml');

    const text = await blob!.text();
    expect(text).toContain('<svg');
    expect(text).toContain('veilStickerFallbackGlow');
  });

  it('5. extractEmojiFromUrl accurately extracts hex-encoded emoji filenames', () => {
    // 0xf09f8c9f = \u{1F31F} (Glowing Star)
    const starUrl = 'https://cdn.combot.online/companyxd_by_fstikbot/webp/0xf09f8c9f.webp';
    const emoji = telegramStickerService.extractEmojiFromUrl(starUrl);
    expect(emoji).toBeTruthy();

    // Invalid or missing hex returns null
    expect(telegramStickerService.extractEmojiFromUrl('https://example.com/regular_image.webp')).toBeNull();
    expect(telegramStickerService.extractEmojiFromUrl('')).toBeNull();
  });

  it('6. AddStickerPackModal uses className="veil-modal-backdrop" and provides token expansion', () => {
    const modalPath = path.join(rootDir, 'src/ui/components/stickers/AddStickerPackModal.tsx');
    const modalSrc = fs.readFileSync(modalPath, 'utf-8');

    expect(modalSrc).toContain('className="veil-modal-backdrop"');
    expect(modalSrc).toContain('Connect Token');
    expect(modalSrc).toMatch(/onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onClose\(\)/);
  });

  it('7. vite.config.ts and relayServer.ts provide preview and proxy parity', () => {
    const viteConfig = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf-8');
    const relayServer = fs.readFileSync(path.join(rootDir, 'src/server/relayServer.ts'), 'utf-8');

    expect(viteConfig).toContain('configurePreviewServer');
    expect(viteConfig).toContain('createStickersMiddleware');
    expect(viteConfig).toContain('Access-Control-Allow-Methods');

    expect(relayServer).toContain('/v1/stickers/proxy');
    expect(relayServer).toContain('x-telegram-bot-token');
  });

  it('8. Phase 44a Zero Literal Unicode Emoji Compliance across all touched source files', () => {
    // Emoji regex matching literal pictographs, surrogate pairs, and variation selectors
    const literalEmojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

    const filesToCheck = [
      'src/media/telegramStickerService.ts',
      'src/ui/components/stickers/AddStickerPackModal.tsx',
      'src/ui/components/ui/ActiveAudioBanner.tsx',
      'src/attachments/voicePlayer.ts',
      'vite.config.ts',
      'src/server/relayServer.ts',
      'src/server/stickers/telegramStickerResolver.ts',
      'src/ui/components/MessageComposer.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (literalEmojiRegex.test(line)) {
          throw new Error(
            `Violation: Literal Unicode emoji found in ${relPath}:${i + 1}:\n${line.trim()}`
          );
        }
      }
    }
  });
});
