import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { IndexedDBStorageAdapter } from '../src/storage/indexedDbAdapter.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { MediaOutbox, type MediaUploadJob } from '../src/attachments/mediaOutbox.ts';
import { MediaCipherCache } from '../src/ui/utils/mediaCipherCache.ts';
import { bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

describe('encrypted media upload outbox', () => {
  const databaseName = 'veil_test_media_outbox';
  const attachmentId = 'att_outbox_restart';
  const bytes = new Uint8Array([31, 41, 59, 26, 53]);
  const hash = bytesToHex(sha256(bytes));
  const makeSession = (spaceId = 'space-outbox') => new SpaceSession(spaceId, 'Outbox test', false, new Uint8Array(32).fill(7));

  beforeEach(async () => {
    const adapter = new IndexedDBStorageAdapter(databaseName);
    await adapter.destroyDatabase();
    await MediaCipherCache.delete('space-outbox', attachmentId);
  });

  afterEach(async () => {
    await MediaCipherCache.delete('space-outbox', attachmentId);
    const adapter = new IndexedDBStorageAdapter(databaseName);
    await adapter.destroyDatabase();
  });

  it('recovers encrypted job metadata and ciphertext after a fresh store instance', async () => {
    const adapter1 = new IndexedDBStorageAdapter(databaseName);
    await adapter1.init();
    const session1 = makeSession();
    const store1 = new EncryptedSpaceStore(adapter1);
    const outbox1 = new MediaOutbox(store1);
    const job: MediaUploadJob = {
      jobId: attachmentId,
      messageId: 'msg_outbox_restart',
      conversationId: 'peer-a',
      kind: 'attachment',
      attachment: {
        attachmentId,
        name: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 5,
        chunkCount: 1,
        chunkSize: 64 * 1024,
        sha256Hash: 'plaintext-hash',
        ciphertextHash: hash,
        encryptionKeyBase64: 'media-key-secret',
      },
      state: 'UPLOADING',
      createdAt: 1,
      updatedAt: 1,
    };
    await outbox1.enqueue(session1, job, bytes);
    const encryptedRecord = await adapter1.getRecord(session1.spaceId, 'veil:media:outbox:v1');
    expect(encryptedRecord?.ciphertext).not.toContain('media-key-secret');
    await adapter1.close();
    session1.destroy();

    const adapter2 = new IndexedDBStorageAdapter(databaseName);
    await adapter2.init();
    const session2 = makeSession();
    const outbox2 = new MediaOutbox(new EncryptedSpaceStore(adapter2));
    const recovered = await outbox2.list(session2);
    expect(recovered).toHaveLength(1);
    expect(await outbox2.getCiphertext(session2, recovered[0])).toEqual(bytes);
    expect(await outbox2.list(makeSession('space-other'))).toEqual([]);
    session2.destroy();
    await adapter2.close();
  });
});
