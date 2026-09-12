import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function createStickersMiddleware() {
  return async (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // Handle OPTIONS Preflight for sticker endpoints
    if (req.method === 'OPTIONS' && (pathname.startsWith('/api/telegram-stickers') || pathname.startsWith('/v1/stickers'))) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-telegram-bot-token');
      res.statusCode = 204;
      res.end();
      return;
    }

    // 1. On-demand Telegram Sticker File Proxy (High-Definition 512x512 WebP)
    if (req.method === 'GET' && (pathname === '/api/telegram-stickers/file' || pathname === '/v1/stickers/file')) {
      const fileId = parsedUrl.searchParams.get('file_id') || '';
      const token =
        parsedUrl.searchParams.get('token') ||
        (req.headers['x-telegram-bot-token'] as string) ||
        process.env.TELEGRAM_BOT_TOKEN ||
        '';

      if (!fileId || !token) {
        res.statusCode = 400;
        res.end('MISSING_FILE_ID_OR_TOKEN');
        return;
      }

      try {
        const { TelegramStickerResolver } = await import('./src/server/stickers/telegramStickerResolver.ts');
        const result = await TelegramStickerResolver.fetchStickerImageBuffer(fileId, token);
        if (result) {
          res.setHeader('Content-Type', result.contentType || 'image/webp');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          res.statusCode = 200;
          res.end(result.buffer);
        } else {
          res.statusCode = 404;
          res.end('STICKER_FILE_NOT_FOUND');
        }
      } catch (err: any) {
        res.statusCode = 500;
        res.end(err?.message || 'PROXY_ERROR');
      }
      return;
    }

    // 2. Generic Third-Party URL Proxy with CORS Headers
    if (req.method === 'GET' && (url.startsWith('/api/telegram-stickers/proxy?url=') || url.startsWith('/v1/stickers/proxy?url=') || pathname === '/api/telegram-stickers/proxy' || pathname === '/v1/stickers/proxy')) {
      const targetUrl = parsedUrl.searchParams.get('url') || (url.startsWith('/api/telegram-stickers/proxy?url=') ? decodeURIComponent(url.slice('/api/telegram-stickers/proxy?url='.length)) : decodeURIComponent(url.slice('/v1/stickers/proxy?url='.length)));
      if (!targetUrl) {
        res.statusCode = 400;
        res.end('MISSING_TARGET_URL');
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), 12000);

        const upstream = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://combot.org/',
            'Accept': 'image/webp,image/png,image/*,*/*',
          },
        });
        clearTimeout(timeoutTimer);

        if (upstream.ok) {
          const contentType = upstream.headers.get('content-type') || 'image/webp';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = 200;
          res.end(buffer);
        } else {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = upstream.status;
          res.end('UPSTREAM_ERROR');
        }
      } catch (err: any) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.statusCode = 500;
        res.end(err?.message || 'PROXY_ERROR');
      }
      return;
    }

    // 3. Telegram Sticker Pack Manifest Resolver
    if (req.method === 'GET' && (pathname.startsWith('/api/telegram-stickers/') || pathname.startsWith('/v1/stickers/'))) {
      const packName = pathname
        .replace(/^\/(?:api\/telegram-stickers|v1\/stickers)\//, '')
        .split('?')[0];

      if (!packName || packName === 'proxy' || packName === 'file') {
        return next();
      }

      try {
        const { TelegramStickerResolver } = await import('./src/server/stickers/telegramStickerResolver.ts');
        const botToken =
          (req.headers['x-telegram-bot-token'] as string) ||
          parsedUrl.searchParams.get('token') ||
          undefined;
        const pack = await TelegramStickerResolver.resolvePack(packName, botToken);
        if (pack) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true, pack }));
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, error: 'STICKER_PACK_NOT_FOUND' }));
        }
      } catch (err: any) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: err?.message || 'INTERNAL_ERROR' }));
      }
      return;
    }

    next();
  };
}

function telegramStickersPlugin() {
  const middleware = createStickersMiddleware();
  return {
    name: 'telegram-stickers-middleware',
    configureServer(server: any) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), telegramStickersPlugin()],
  server: {
    port: 5173,
  },
});
