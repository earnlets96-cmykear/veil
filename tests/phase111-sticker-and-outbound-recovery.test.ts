import { describe, expect, it, vi } from 'vitest';
import { telegramStickerService } from '../src/media/telegramStickerService.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 111: sticker asset validation and outbound queue recovery', () => {
  it('rejects an HTTP-200 HTML sticker response and falls through to an image proxy', async () => {
    const fetchedUrls: string[] = [];
    const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchedUrls.push(url);
      if (url.startsWith('https://cdn.combot.online/')) {
        return new Response('<html>provider rate limit</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      if (url.includes('/stickers/proxy?url=')) {
        return new Response(webp, { status: 200, headers: { 'Content-Type': 'image/webp' } });
      }
      return new Response('not found', { status: 404 });
    }) as any;

    const blob = await telegramStickerService.fetchStickerBlob(
      'https://cdn.combot.online/sample_pack/webp/sticker.webp',
      { allowSyntheticFallback: false }
    );

    expect(blob.type).toBe('image/webp');
    expect(blob.size).toBe(webp.length);
    expect(fetchedUrls.some((url) => url.includes('/stickers/proxy?url='))).toBe(true);
  });

  it('flushes queued outgoing messages after a successful empty-inbox sync', async () => {
    const vault = new SpaceVaultManager();
    const envelope = vault.createSpace({ name: 'Queue Test', password: 'QueueTest123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('QueueTest123!', envelope.spaceId);
    const manager = new NetworkManager(new EncryptedSpaceStore(new MemoryStorageAdapter()), {
      httpUrl: 'https://relay.invalid',
      wsUrl: 'wss://relay.invalid/v1/ws',
    });

    vi.spyOn(manager, 'getMailboxBinding').mockResolvedValue({
      spaceId: session.spaceId,
      mailboxId: 'mailbox-test',
      capabilityToken: 'capability-test',
      expiresAt: Date.now() + 60_000,
      lastSyncAt: Date.now(),
    });
    vi.spyOn(manager.getHttp(), 'fetchEnvelopes').mockResolvedValue({ envelopes: [] } as any);
    const flush = vi.spyOn(manager, 'flushOutboundQueue').mockResolvedValue(0);

    await manager.syncMailbox(session);

    expect(flush).toHaveBeenCalledWith(session);
  });

  it('shows locally queued text as queued instead of an endless sending spinner', () => {
    const appState = fs.readFileSync(path.resolve(__dirname, '../src/ui/app/AppState.tsx'), 'utf8');
    expect(appState).toContain("deliveryStatus = sendRes.status === 'QUEUED' ? 'QUEUED' : 'SENDING'");
  });
});
