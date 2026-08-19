/**
 * VEIL Phase 27: Encrypted Attachment Storage & Object Storage Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex, randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 27: Encrypted Attachment Storage', () => {
  let server: RelayServer;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;
  let serverUrl: string;
  let client: CloudClient;

  beforeEach(async () => {
    cloudDb = new MemoryCloudDatabase();
    objectStorage = new LocalDiskObjectStorage();
    const relayStore = new MemoryRelayStore();

    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      relayStore,
      cloudDb,
      objectStorage
    );

    const addr = await server.start();
    serverUrl = `http://127.0.0.1:${addr.port}`;

    client = new CloudClient({ baseUrl: serverUrl });
    await client.registerAccount({
      username: '@attachment_tester',
      password: 'AttachmentPass123!',
      deviceId: 'dev_att_1',
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('ENCRYPTED ATTACHMENT PIPELINE: Encrypts, uploads, verifies integrity, downloads, and decrypts', async () => {
    // 1. Generate 256 KiB confidential binary payload
    const originalPlaintext = randomBytes(256 * 1024);
    const encryptionKey = randomBytes(32);

    // 2. Client-side encryption
    const encResult = encryptXChaCha20Poly1305(encryptionKey, originalPlaintext);
    const ciphertextHash = bytesToHex(sha256(encResult.ciphertext));

    // 3. Register Attachment metadata
    const createRes = await client.createAttachment({
      attachmentId: 'att_confidential_pdf',
      spaceId: 'space_work',
      ciphertextSize: encResult.ciphertext.length,
      ciphertextHash,
    });

    const objectId = createRes.attachment.objectId;
    expect(objectId).toMatch(/^obj_/);

    // 4. Upload ciphertext to Object Storage
    await client.uploadAttachment(objectId, encResult.ciphertext);

    // 5. Download ciphertext and verify integrity
    const downloadedCiphertext = await client.downloadAttachment(objectId);
    expect(downloadedCiphertext.length).toBe(encResult.ciphertext.length);

    // 6. Client-side decryption
    const decrypted = decryptXChaCha20Poly1305(encryptionKey, encResult.nonce, downloadedCiphertext);
    expect(decrypted).toEqual(originalPlaintext);

    // 7. Verify zero plaintext in server database / storage
    const serverObj = await objectStorage.download(objectId);
    expect(serverObj).not.toEqual(originalPlaintext);
    expect(serverObj).toEqual(encResult.ciphertext);
  });

  it('INTEGRITY REJECTION: Rejects corrupted ciphertext upon upload or download', async () => {
    const originalPlaintext = new TextEncoder().encode('Confidential Report Content');
    const encryptionKey = randomBytes(32);
    const encResult = encryptXChaCha20Poly1305(encryptionKey, originalPlaintext);
    const ciphertextHash = bytesToHex(sha256(encResult.ciphertext));

    const createRes = await client.createAttachment({
      attachmentId: 'att_corrupt_test',
      spaceId: 'space_work',
      ciphertextSize: encResult.ciphertext.length,
      ciphertextHash,
    });

    // Attempt upload with tampered ciphertext
    const corruptedCiphertext = new Uint8Array(encResult.ciphertext);
    corruptedCiphertext[0] ^= 0xff; // Flip bits

    await expect(
      client.uploadAttachment(createRes.attachment.objectId, corruptedCiphertext)
    ).rejects.toThrow(/integrity verification failed/i);
  });

  it('ATTACHMENT DELETION: Deletes object from storage and marks metadata deleted', async () => {
    const data = randomBytes(1024);
    const encResult = encryptXChaCha20Poly1305(randomBytes(32), data);
    const hash = bytesToHex(sha256(encResult.ciphertext));

    const createRes = await client.createAttachment({
      attachmentId: 'att_del_test',
      spaceId: 'space_work',
      ciphertextSize: encResult.ciphertext.length,
      ciphertextHash: hash,
    });

    await client.uploadAttachment(createRes.attachment.objectId, encResult.ciphertext);
    expect(await objectStorage.exists(createRes.attachment.objectId)).toBe(true);

    // Delete attachment
    await client.deleteAttachment('space_work', 'att_del_test');

    // Object is removed
    expect(await objectStorage.exists(createRes.attachment.objectId)).toBe(false);
    await expect(client.downloadAttachment(createRes.attachment.objectId)).rejects.toThrow(/not found|missing/i);
  });
});
