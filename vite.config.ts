import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function telegramStickersPlugin() {
  return {
    name: 'telegram-stickers-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';
        if (req.method === 'GET' && url.startsWith('/api/telegram-stickers/proxy?url=')) {
          const rawTarget = url.slice('/api/telegram-stickers/proxy?url='.length);
          const targetUrl = decodeURIComponent(rawTarget);
          if (!targetUrl) return next();
          try {
            const upstream = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
              },
            });
            if (upstream.ok) {
              const contentType = upstream.headers.get('content-type') || 'image/webp';
              res.setHeader('Content-Type', contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              const buffer = Buffer.from(await upstream.arrayBuffer());
              res.statusCode = 200;
              res.end(buffer);
            } else {
              res.statusCode = upstream.status;
              res.end('UPSTREAM_ERROR');
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.end(err?.message || 'PROXY_ERROR');
          }
          return;
        }

        if (req.method === 'GET' && url.startsWith('/api/telegram-stickers/')) {
          const packName = url.replace(/^\/api\/telegram-stickers\//, '').split('?')[0];
          if (!packName) return next();

          try {
            const { TelegramStickerResolver } = await import('./src/server/stickers/telegramStickerResolver.ts');
            const botToken = (req.headers['x-telegram-bot-token'] as string) || undefined;
            const pack = await TelegramStickerResolver.resolvePack(packName, botToken);
            if (pack) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, pack }));
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 404;
              res.end(JSON.stringify({ ok: false, error: 'STICKER_PACK_NOT_FOUND' }));
            }
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: err?.message || 'INTERNAL_ERROR' }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), telegramStickersPlugin()],
  server: {
    port: 5173,
  },
});
