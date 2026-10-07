import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';
import { telegramStickerService } from '../src/media/telegramStickerService.ts';

describe('sticker drawer and notification delivery regressions', () => {
  it('keeps the emoji drawer open when a sticker is selected', () => {
    const composer = readFileSync('src/ui/components/MessageComposer.tsx', 'utf8');
    const handler = composer.match(/const handleSelectSticker = useCallback\(([\s\S]*?)\n  \/\/ Voice recording controls/);
    expect(handler).toBeTruthy();
    expect(handler?.[1]).not.toContain('setIsEmojiDrawerOpen(false)');
  });

  it('loads relay-hosted sticker files directly and uses the HTTP cache', async () => {
    const requests: string[] = [];
    vi.stubGlobal('window', {
      location: { origin: 'https://app.example' },
      localStorage: { getItem: () => null },
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(String(input));
      expect(init?.cache).toBe('force-cache');
      return new Response(new Blob(['sticker'], { type: 'image/webp' }), {
        status: 200,
        headers: { 'content-type': 'image/webp' },
      });
    });
    try {
      const blob = await telegramStickerService.fetchStickerBlob(
        '/api/telegram-stickers/file?file_id=phase112-' + Date.now(),
        { allowSyntheticFallback: false }
      );
      expect(blob.type).toBe('image/webp');
      expect(requests).toEqual([
        expect.stringMatching(/^https:\/\/veil-rga0\.onrender\.com\/api\/telegram-stickers\/file\?/),
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('dispatches a privacy-filtered system notification when browser permission is granted', () => {
    const notificationMock = vi.fn();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: Object.assign(notificationMock, { permission: 'granted' }),
    });
    const dispatcher = new NotificationDispatcher('SENDER_ONLY');
    expect(dispatcher.dispatch({ conversationId: 'c1', senderName: 'Sam', text: 'secret message' })).toBe(true);
    expect(notificationMock).toHaveBeenCalledWith('VEIL', expect.objectContaining({ body: 'New message from Sam' }));
    expect(notificationMock.mock.calls[0]?.[1]?.body).not.toContain('secret message');
  });

  it('does not claim notification delivery when permission is unavailable', () => {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: Object.assign(vi.fn(), { permission: 'default' }),
    });
    expect(new NotificationDispatcher().dispatch({ conversationId: 'c1', senderName: 'Sam' })).toBe(false);
  });
});
