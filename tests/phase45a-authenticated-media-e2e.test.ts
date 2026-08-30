import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { bytesToHex, randomBytes } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

describe('Phase 45A: authenticated recipient media delivery', () => {
  let server: RelayServer; let url: string;
  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' }, new MemoryRelayStore(), new MemoryCloudDatabase(), new LocalDiskObjectStorage());
    const address = await server.start(); url = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => { await server.stop(); });

  it('allows only the canonical authenticated recipient to download and decrypt sender ciphertext', async () => {
    const alice = new CloudClient(url); const bob = new CloudClient(url); const mallory = new CloudClient(url);
    await alice.registerAccount({ username: 'alice45a', password: 'AlicePassword123!', deviceId: 'alice-device' });
    await bob.registerAccount({ username: 'bob45a', password: 'BobPassword123!', deviceId: 'bob-device' });
    await mallory.registerAccount({ username: 'mallory45a', password: 'MalloryPassword123!', deviceId: 'mallory-device' });
    const plaintext = new TextEncoder().encode('encrypted image payload'); const key = randomBytes(32);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(plaintext, 'image.jpg', 'image/jpeg', key);
    const ciphertext = new TextEncoder().encode(JSON.stringify(chunks));
    const created = await alice.createAttachment({ attachmentId: metadata.attachmentId, spaceId: 'alice-space', ciphertextSize: ciphertext.length, ciphertextHash: bytesToHex(sha256(ciphertext)), recipientUsername: 'bob45a' });
    await alice.uploadAttachment(created.attachment.objectId, ciphertext);
    const downloaded = await bob.downloadAttachment(created.attachment.objectId);
    expect(AttachmentPipeline.decryptAndReassemble(metadata, JSON.parse(new TextDecoder().decode(downloaded)), key)).toEqual(plaintext);
    await expect(mallory.downloadAttachment(created.attachment.objectId)).rejects.toThrow(/not found|access denied/i);
  });
});
