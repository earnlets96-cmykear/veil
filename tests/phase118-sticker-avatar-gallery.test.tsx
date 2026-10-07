import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../src/ui/components/ui/Avatar.tsx';
import { getGalleryAttachmentEntries } from '../src/ui/components/media/galleryAttachments.ts';
import { resolveConversationAvatar } from '../src/ui/utils/avatarPresentation.ts';
import { telegramStickerService } from '../src/media/telegramStickerService.ts';

describe('sticker, avatar, and shared gallery regressions', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows profile photos as an image with a deterministic fallback underneath', () => {
    const html = renderToStaticMarkup(<Avatar name="Ada Lovelace" imageUrl="https://cdn.example/ada.jpg" size="md" />);
    expect(html).toContain('<img');
    expect(html).toContain('https://cdn.example/ada.jpg');
    expect(html).toContain('A');
  });

  it('uses the current direct contact avatar before stale conversation metadata', () => {
    expect(resolveConversationAvatar({ type: 'direct', avatar: 'old.jpg' }, 'current.jpg')).toBe('current.jpg');
    expect(resolveConversationAvatar({ type: 'group', avatar: 'group.jpg' }, 'contact.jpg')).toBe('group.jpg');
  });

  it('includes grouped attachments in the shared media and files list', () => {
    const entries = getGalleryAttachmentEntries([
      { id: 'grouped', timestamp: 1, attachments: [
        { name: 'photo.jpg', mimeType: 'image/jpeg' },
        { name: 'report.pdf', mimeType: 'application/pdf' },
      ] },
      { id: 'single', timestamp: 2, attachment: { name: 'notes.txt', mimeType: 'text/plain' } },
    ]);

    expect(entries.filter((entry) => entry.category === 'media').map((entry) => entry.attachment.name)).toEqual(['photo.jpg']);
    expect(entries.filter((entry) => entry.category === 'file').map((entry) => entry.attachment.name)).toEqual(['report.pdf', 'notes.txt']);
    expect(entries.map((entry) => entry.message.id)).toEqual(['grouped', 'grouped', 'single']);
  });

  it('reuses a previously loaded sticker asset after the in-memory cache is cleared', async () => {
    const stickerUrl = `https://stickers.example/${crypto.randomUUID()}.webp`;
    const fetchMock = vi.fn(async () => new Response(new Blob(['image bytes'], { type: 'image/webp' }), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await telegramStickerService.fetchStickerBlob(stickerUrl, { allowSyntheticFallback: false });
    const callsAfterFirstLoad = fetchMock.mock.calls.length;
    (telegramStickerService as any).blobCache.clear();

    const cached = await telegramStickerService.fetchStickerBlob(stickerUrl, { allowSyntheticFallback: false });
    expect(cached.type).toBe('image/webp');
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirstLoad);
  });
});
