import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { recoverInterruptedUploads } from '../src/ui/app/messageRecovery.ts';
import { MediaCacheManager } from '../src/ui/utils/mediaCache.ts';
import { MediaCipherCacheManager } from '../src/ui/utils/mediaCipherCache.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

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
    const cipherCache = new MediaCipherCacheManager();
    const session = new SpaceSession('sticker-space', 'Sticker Space', false, new Uint8Array(32).fill(3));
    const ciphertext = new Uint8Array([1, 2, 3]);
    const hash = bytesToHex(sha256(ciphertext));
    await cipherCache.put(session.spaceId, 'sticker-object', ciphertext, hash);

    await cache.invalidate('sticker-object', session, 'sticker-object');
    expect(await cipherCache.get(session.spaceId, 'sticker-object', hash)).toBeNull();
    session.destroy();
  });
});
