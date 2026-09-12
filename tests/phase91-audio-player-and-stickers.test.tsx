/**
 * Phase 91 Test Suite:
 * - AudioPlayerCard Single HTMLAudioElement Lifecycle, Play/Pause Synchronization, and Smooth Seeking
 * - Telegram Sticker Pack Link Parsing, Backend Resolver, and Auto-Scroll Preview
 * - Phase 44a Zero Literal Unicode Emoji Compliance
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { telegramStickerService } from '../src/media/telegramStickerService.ts';
import { TelegramStickerResolver } from '../src/server/stickers/telegramStickerResolver.ts';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 91: AudioPlayerCard Single Lifecycle & Play/Pause Synchronization', () => {
  const audioCardSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'),
    'utf-8'
  );

  it('manages a single HTMLAudioElement in useEffect without duplicate instantiation in handlePlayToggle', () => {
    // Count occurrences of 'new Audio(' in AudioPlayerCard.tsx
    const newAudioMatches = audioCardSource.match(/new\s+Audio\(/g) || [];
    expect(newAudioMatches.length).toBe(1);

    // Verify it uses autoPlayPendingRef to coordinate playback after resolution
    expect(audioCardSource).toContain('autoPlayPendingRef.current = true;');
    expect(audioCardSource).toContain('if (autoPlayPendingRef.current)');
  });

  it('synchronizes isPlaying state directly via native play and pause event listeners', () => {
    expect(audioCardSource).toMatch(/const\s+onPlay\s*=\s*\(\)\s*=>\s*setIsPlaying\(true\)/);
    expect(audioCardSource).toMatch(/const\s+onPause\s*=\s*\(\)\s*=>\s*setIsPlaying\(false\)/);
    expect(audioCardSource).toContain("audio.addEventListener('play', onPlay);");
    expect(audioCardSource).toContain("audio.addEventListener('pause', onPause);");
    expect(audioCardSource).toContain("audio.removeEventListener('play', onPlay);");
    expect(audioCardSource).toContain("audio.removeEventListener('pause', onPause);");
  });

  it('subscribes to global veil:audio:play events to pause when another audio starts', () => {
    expect(audioCardSource).toContain("window.addEventListener('veil:audio:play', handleGlobalPlay);");
    expect(audioCardSource).toContain("window.removeEventListener('veil:audio:play', handleGlobalPlay);");
    expect(audioCardSource).toContain("window.dispatchEvent(new CustomEvent('veil:audio:play'");
  });

  it('implements smooth seeking by updating visual state during drag and committing on pointerup', () => {
    expect(audioCardSource).toContain('targetSeekTimeRef.current = targetSeconds;');
    expect(audioCardSource).toContain('const updateScrubberVisual = (clientX: number) => {');

    // Drag move updates visual scrubber only
    expect(audioCardSource).toMatch(
      /const\s+onPointerMove\s*=\s*\(moveEvent:\s*PointerEvent\)\s*=>\s*\{[\s\S]*?updateScrubberVisual\(moveEvent\.clientX\)/
    );

    // Pointer up commits to audio.currentTime once
    expect(audioCardSource).toMatch(
      /const\s+onPointerUp\s*=\s*\(upEvent:\s*PointerEvent\)\s*=>\s*\{[\s\S]*?audioRef\.current\.currentTime\s*=\s*targetSeekTimeRef\.current/
    );
  });
});

describe('Phase 91: Telegram Sticker Link Parsing & Backend Resolver', () => {
  it('accurately parses Telegram sticker set links in all standard formats', () => {
    const link1 = 'https://t.me/addstickers/Zane_fozol_0_9';
    const link2 = 't.me/addstickers/Zane_fozol_0_9';
    const link3 = 'tg://addstickers?set=Zane_fozol_0_9';
    const link4 = 'Zane_fozol_0_9';

    expect(telegramStickerService.parseTelegramPackUrl(link1)).toBe('Zane_fozol_0_9');
    expect(telegramStickerService.parseTelegramPackUrl(link2)).toBe('Zane_fozol_0_9');
    expect(telegramStickerService.parseTelegramPackUrl(link3)).toBe('Zane_fozol_0_9');
    expect(telegramStickerService.parseTelegramPackUrl(link4)).toBe('Zane_fozol_0_9');
  });

  it('decodes UTF-8 hex emoji representations without raw literal emojis', () => {
    // 0xf09f9883 is grinning face
    const grinningHex = 'f09f9883';
    const decoded = TelegramStickerResolver.decodeHexEmoji(grinningHex);
    expect(decoded).toBeTruthy();
    expect(decoded.charCodeAt(0)).toBe(0xd83d); // High surrogate for U+1F603
  });

  it('gracefully handles empty or invalid hex strings', () => {
    expect(TelegramStickerResolver.decodeHexEmoji('')).toBe('\u{2B50}');
    expect(TelegramStickerResolver.decodeHexEmoji('not-a-hex-value')).toBe('\u{2B50}');
  });

  it('resolves Zane_fozol_0_9 sticker pack via TelegramStickerResolver with 20 webp stickers', async () => {
    const pack = await TelegramStickerResolver.resolvePack('Zane_fozol_0_9');
    expect(pack).not.toBeNull();
    expect(pack?.id).toBe('zane_fozol_0_9');
    expect(pack?.name).toBe('Zane_fozol_0_9');
    expect(pack?.stickers.length).toBe(20);

    const firstSticker = pack!.stickers[0];
    expect(firstSticker.url).toMatch(/^https:\/\/cdn\.combot\.online\/zane_fozol_0_9\/webp\/.*\.webp$/);
    expect(firstSticker.width).toBe(512);
    expect(firstSticker.height).toBe(512);
    expect(firstSticker.emoji).toBeTruthy();
  }, 15000);

  it('AddStickerPackModal attaches previewRef and auto-scrolls into view upon pack resolution', () => {
    const modalSource = fs.readFileSync(
      path.join(rootDir, 'src/ui/components/stickers/AddStickerPackModal.tsx'),
      'utf-8'
    );

    expect(modalSource).toContain('const previewRef = useRef<HTMLDivElement>(null);');
    expect(modalSource).toContain('ref={previewRef}');
    expect(modalSource).toContain("previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });");
  });

  it('telegramStickerService.ts queries local server and relay endpoints', () => {
    const serviceSource = fs.readFileSync(
      path.join(rootDir, 'src/media/telegramStickerService.ts'),
      'utf-8'
    );

    expect(serviceSource).toContain('/api/telegram-stickers/${encodeURIComponent(packName)}');
    expect(serviceSource).toContain('/v1/stickers/${encodeURIComponent(packName)}');
  });
});

describe('Phase 91: Strict Phase 44a Zero Literal Unicode Emoji Compliance', () => {
  it('confirms all modified and newly created files have zero raw literal Unicode emojis', () => {
    const filesToCheck = [
      path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'),
      path.join(rootDir, 'src/server/stickers/telegramStickerResolver.ts'),
      path.join(rootDir, 'src/server/relayServer.ts'),
      path.join(rootDir, 'src/media/telegramStickerService.ts'),
      path.join(rootDir, 'src/ui/components/stickers/AddStickerPackModal.tsx'),
      path.join(rootDir, 'vite.config.ts'),
      path.join(rootDir, 'tests/phase91-audio-player-and-stickers.test.tsx'),
    ];

    const literalEmojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;

    for (const file of filesToCheck) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        expect(literalEmojiRegex.test(content)).toBe(false);
      }
    }
  });
});
