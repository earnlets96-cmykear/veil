import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { recoverInterruptedUploads } from '../src/ui/app/messageRecovery.ts';
import { MediaCacheManager } from '../src/ui/utils/mediaCache.ts';

describe('media and upload recovery after app re-entry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks outgoing uploads as interrupted when their process-local worker is gone', () => {
    const messages = {
      conversation: [
        {
          id: 'pending-image',
          conversationId: 'conversation',
          senderId: 'me',
          text: '',
          isOutgoing: true,
          timestamp: 1,
          status: 'UPLOADING' as const,
          attachment: { name: 'image.jpg', mimeType: 'image/jpeg', sizeBytes: 32, state: 'UPLOADING' },
          attachments: [{ name: 'image.jpg', mimeType: 'image/jpeg', sizeBytes: 32, state: 'UPLOADING' }],
        },
        {
          id: 'sent-image',
          conversationId: 'conversation',
          senderId: 'me',
          text: '',
          isOutgoing: true,
          timestamp: 2,
          status: 'SENT_TO_RELAY' as const,
          attachment: { name: 'sent.jpg', mimeType: 'image/jpeg', sizeBytes: 32, state: 'SENT' },
        },
        {
          id: 'incoming-image',
          conversationId: 'conversation',
          senderId: 'peer',
          text: '',
          isOutgoing: false,
          timestamp: 3,
          status: 'UPLOADING' as const,
        },
      ],
    };

    const recovered = recoverInterruptedUploads(messages as any);
    expect(recovered.conversation[0].status).toBe('FAILED');
    expect(recovered.conversation[0].attachment?.state).toBe('FAILED');
    expect(recovered.conversation[0].attachment?.error).toMatch(/app closed/i);
    expect(recovered.conversation[0].attachments?.[0].state).toBe('FAILED');
    expect(recovered.conversation[1]).toBe(messages.conversation[1]);
    expect(recovered.conversation[2]).toBe(messages.conversation[2]);
  });

  it('retrieves sent encrypted stickers instead of turning a dead blob preview into a star', () => {
    const source = fs.readFileSync('src/ui/components/media/MediaImage.tsx', 'utf8');
    expect(source).toContain('if (isSticker && (attachment.objectId || attachment.attachmentId))');
    expect(source).toContain('fetchAndDecrypt(true);');
    expect(source).toContain("!url.startsWith('blob:')");
  });

  it('deletes invalid media from durable cache so a bad sticker fallback cannot return after restart', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    const cache = new MediaCacheManager();
    const db = await (cache as any).getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put({ id: 'sticker-object', data: new Uint8Array([1]), mimeType: 'image/svg+xml', name: 'sticker.webp' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await cache.invalidate('sticker-object');
    const stored = await new Promise((resolve) => {
      const req = db.transaction('media', 'readonly').objectStore('media').get('sticker-object');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    expect(stored).toBeUndefined();
    db.close();
  });
});
