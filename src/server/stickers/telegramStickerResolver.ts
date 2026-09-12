/**
 * Telegram Sticker Pack Server-Side Resolver.
 *
 * Resolves Telegram sticker set links/names into full StickerPack manifests
 * with individual sticker URLs, emojis, and dimensions, without browser CORS restrictions.
 */

export interface ResolvedStickerItem {
  id: string;
  packId: string;
  emoji: string;
  url: string;
  width: number;
  height: number;
}

export interface ResolvedStickerPack {
  id: string;
  name: string;
  title: string;
  thumbnailUrl: string;
  stickers: ResolvedStickerItem[];
  installedAt: number;
}

export class TelegramStickerResolver {
  // In-memory cache for file_id -> { buffer, contentType, timestamp }
  private static fileBufferCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
  // In-memory cache for file_id -> Telegram file_path
  private static filePathCache = new Map<string, string>();

  /**
   * Fetches high-resolution sticker WebP image buffer via Telegram Bot getFile API on-demand.
   */
  public static async fetchStickerImageBuffer(
    fileId: string,
    botToken: string
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const cleanFileId = fileId.trim();
    const cleanToken = botToken.trim();
    if (!cleanFileId || !cleanToken) return null;

    // 1. Check buffer cache (valid for 24 hours)
    const cached = TelegramStickerResolver.fileBufferCache.get(cleanFileId);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return { buffer: cached.buffer, contentType: cached.contentType };
    }

    // 2. Resolve file_path from Telegram Bot API if not known
    let filePath = TelegramStickerResolver.filePathCache.get(cleanFileId);
    if (!filePath) {
      try {
        const getFileRes = await fetch(
          `https://api.telegram.org/bot${cleanToken}/getFile?file_id=${encodeURIComponent(cleanFileId)}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (getFileRes.ok) {
          const fileData: any = await getFileRes.json();
          if (fileData.ok && fileData.result?.file_path) {
            filePath = fileData.result.file_path;
            TelegramStickerResolver.filePathCache.set(cleanFileId, filePath as string);
          }
        }
      } catch {}
    }

    if (!filePath) return null;

    // 3. Download the full 512x512 High-Definition WebP sticker
    try {
      const fileRes = await fetch(
        `https://api.telegram.org/file/bot${cleanToken}/${filePath}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!fileRes.ok) return null;

      const contentType = fileRes.headers.get('content-type') || 'image/webp';
      const arrayBuf = await fileRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // LRU eviction if cache exceeds 500 stickers (~15MB)
      if (TelegramStickerResolver.fileBufferCache.size > 500) {
        const firstKey = TelegramStickerResolver.fileBufferCache.keys().next().value;
        if (firstKey) TelegramStickerResolver.fileBufferCache.delete(firstKey);
      }

      TelegramStickerResolver.fileBufferCache.set(cleanFileId, {
        buffer,
        contentType,
        timestamp: Date.now(),
      });

      return { buffer, contentType };
    } catch {
      return null;
    }
  }

  /**
   * Decodes a hex-encoded UTF-8 string into emoji characters safely without literal emojis.
   */
  public static decodeHexEmoji(hex: string): string {
    if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) {
      return '\u{2B50}';
    }
    try {
      if (typeof Buffer !== 'undefined') {
        const decoded = Buffer.from(hex, 'hex').toString('utf8');
        if (decoded && decoded.trim()) return decoded;
      }
      // Browser / standard escape fallback
      const bytes = hex.match(/.{1,2}/g)?.map((byte) => '%' + byte).join('') || '';
      const decoded = decodeURIComponent(bytes);
      return decoded || '\u{2B50}';
    } catch {
      return '\u{2B50}';
    }
  }

  /**
   * Resolves a Telegram sticker set by name from multiple reliable upstream providers.
   */
  public static async resolvePack(
    packName: string,
    botToken?: string
  ): Promise<ResolvedStickerPack | null> {
    const cleanName = packName.trim();
    if (!cleanName) return null;
    const lowerId = cleanName.toLowerCase();

    // Determine effective bot token (argument or server environment variable)
    const effectiveToken =
      (botToken && botToken.trim()) ||
      (typeof process !== 'undefined' && process.env && process.env.TELEGRAM_BOT_TOKEN) ||
      '';

    // 1. Try Telegram Bot API if a bot token is available
    if (effectiveToken) {
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${effectiveToken}/getStickerSet?name=${encodeURIComponent(cleanName)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (tgRes.ok) {
          const data: any = await tgRes.json();
          if (data.ok && data.result) {
            const result = data.result;
            const rawStickers = result.stickers || [];
            // Note: Never slice or truncate stickers; retain full set (120+ stickers)
            const stickers: ResolvedStickerItem[] = rawStickers.map((s: any, idx: number) => ({
              id: s.file_unique_id || s.file_id || `${lowerId}_${idx}`,
              packId: lowerId,
              emoji: s.emoji || '\u{2B50}',
              // Serve on-demand via server file proxy with caching and full 512x512 resolution
              url: `/api/telegram-stickers/file?file_id=${encodeURIComponent(s.file_id)}&token=${encodeURIComponent(effectiveToken)}`,
              width: s.width || 512,
              height: s.height || 512,
            }));

            if (stickers.length > 0) {
              return {
                id: lowerId,
                name: cleanName,
                title: result.title || cleanName,
                thumbnailUrl: stickers[0].url,
                stickers,
                installedAt: Date.now(),
              };
            }
          }
        }
      } catch {}
    }

    // 2. Try Combot Sticker Indexer (indexes millions of public Telegram packs)
    try {
      const combotRes = await fetch(`https://combot.org/stickers/${encodeURIComponent(cleanName)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (combotRes.ok) {
        const html = await combotRes.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1] : '';
        title = title
          .replace(/ — Telegram stickers.*/i, '')
          .replace(/ - Telegram stickers.*/i, '')
          .trim();

        // Match WebP CDN patterns: https://cdn.combot.online/:packName/webp/:file.webp
        const rawWebps = Array.from(html.matchAll(/https:\/\/cdn\.combot\.online\/[^\s"'<>]+\.webp/gi)).map(
          (m) => m[0]
        );
        const uniqueUrls = Array.from(new Set(rawWebps));

        if (uniqueUrls.length > 0) {
          const stickers: ResolvedStickerItem[] = uniqueUrls.map((url, idx) => {
            // Filename format: e.g. "0xf09f9883.webp" or "1x<hex>.webp"
            const filenameMatch = url.match(/\/([^\/]+)\.webp$/i);
            const filename = filenameMatch ? filenameMatch[1] : '';
            const hexMatch = filename.match(/x([0-9a-fA-F]+)$/i);
            const hex = hexMatch ? hexMatch[1] : '';
            const emoji = hex ? TelegramStickerResolver.decodeHexEmoji(hex) : '\u{2B50}';

            return {
              id: `${lowerId}_${idx}`,
              packId: lowerId,
              emoji,
              url,
              width: 512,
              height: 512,
            };
          });

          return {
            id: lowerId,
            name: cleanName,
            title: title || cleanName,
            thumbnailUrl: stickers[0].url,
            stickers,
            installedAt: Date.now(),
          };
        }
      }
    } catch {}

    // 3. Try stickers.wiki Gateway
    try {
      const wikiRes = await fetch(`https://stickers.wiki/telegram/${encodeURIComponent(cleanName)}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (wikiRes.ok) {
        const html = await wikiRes.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1] : '';
        title = title
          .replace(/ - Sticker pack for Telegram.*/i, '')
          .replace(/ - Stickers Wiki.*/i, '')
          .trim();

        const matches = Array.from(
          html.matchAll(/https:\/\/assets\.stickers\.wiki\/img\/([a-f0-9]+)\.webp/g)
        ).map((m) => m[0]);
        const uniqueUrls = Array.from(new Set(matches));

        if (uniqueUrls.length > 0) {
          const stickers: ResolvedStickerItem[] = uniqueUrls.slice(0, 100).map((url, idx) => ({
            id: `${lowerId}_${idx}`,
            packId: lowerId,
            emoji: '\u{1F31F}',
            url,
            width: 512,
            height: 512,
          }));

          return {
            id: lowerId,
            name: cleanName,
            title: title || cleanName,
            thumbnailUrl: stickers[0].url,
            stickers,
            installedAt: Date.now(),
          };
        }
      }
    } catch {}

    return null;
  }
}
