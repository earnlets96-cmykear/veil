import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import fs from 'node:fs';
import path from 'node:path';
import { CloudClient } from '../src/network/cloudClient.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { telegramStickerService, StickerPack } from '../src/media/telegramStickerService.ts';

describe('Phase 105 media responsiveness', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses the hash already computed off the main thread for raw media upload', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new CloudClient('https://veil.example');
    client.setSession('a'.repeat(64), 'account', 'device');

    await client.uploadAttachment(
      'object-id',
      new Uint8Array([1, 2, 3]),
      undefined,
      'precomputed-sha256'
    );

    const request = fetchMock.mock.calls[0];
    const headers = (request[1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Ciphertext-Hash']).toBe('precomputed-sha256');
  });

  it('uses the cooperative encoder for the legacy JSON upload fallback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const encoder = vi.spyOn(AttachmentPipeline, 'bytesToBase64Async').mockResolvedValue('AQID');

    const client = new CloudClient('https://veil.example');
    client.setSession('a'.repeat(64), 'account', 'device');
    await client.uploadAttachment('object-id', new Uint8Array([1, 2, 3]), undefined, 'known-hash');

    expect(encoder).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    encoder.mockRestore();
  });

  it('keeps an imported sticker pack after the in-memory cache is cleared', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    const pack: StickerPack = {
      id: 'phase105_persisted_pack',
      name: 'phase105_persisted_pack',
      title: 'Persisted pack',
      thumbnailUrl: '',
      stickers: [],
      installedAt: Date.now(),
    };

    await telegramStickerService.installStickerPack(pack);
    (telegramStickerService as any).inMemoryPacks.delete(pack.id);

    const installed = await telegramStickerService.getInstalledPacks();
    expect(installed.find((item) => item.id === pack.id)).toEqual(pack);

    await telegramStickerService.removeStickerPack(pack.id);
  });

  it('defers media fetches until a message thumbnail is near the viewport', () => {
    const mediaImage = fs.readFileSync(path.resolve('src/ui/components/media/MediaImage.tsx'), 'utf8');
    expect(mediaImage).toContain('new IntersectionObserver(');
    expect(mediaImage).toContain("{ rootMargin: '480px 0px' }");
    expect(mediaImage).toContain('if (!isNearViewport) return;');
  });

  it('offers the sticker pack from a sent sticker and persists its pack identity in the filename', () => {
    const composer = fs.readFileSync(path.resolve('src/ui/components/MessageComposer.tsx'), 'utf8');
    const conversation = fs.readFileSync(path.resolve('src/ui/components/ConversationView.tsx'), 'utf8');
    expect(composer).toContain('`${safePackId}__${sticker.id}.sticker.${ext}`');
    expect(conversation).toContain('Add sticker pack');
    expect(conversation).toContain('telegramStickerService.installStickerPack(pack)');
  });

  it('uses a single loading state and accent-colored controls while voice seeks buffer', () => {
    const banner = fs.readFileSync(path.resolve('src/ui/components/ui/ActiveAudioBanner.tsx'), 'utf8');
    const player = fs.readFileSync(path.resolve('src/attachments/voicePlayer.ts'), 'utf8');
    const styles = fs.readFileSync(path.resolve('src/styles/veil-components.css'), 'utf8');
    expect(banner).toContain('activeTrack.isLoading');
    expect(player).toContain('this.activeTrackMeta.isLoading = status === \'loading\'');
    expect(styles).toContain('background: var(--veil-accent-primary, #14b8a6);');
  });
});
