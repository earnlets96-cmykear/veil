/**
 * VEIL Phase 30: Complete Normal File Attachment Pipeline Tests.
 *
 * Verifies end-to-end file encryption, authenticated chunking, cloud attachment
 * registration, R2 upload, Double Ratchet packaging, recipient download, multi-chunk
 * reassembly, SHA-256 integrity verification, and access control boundaries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { randomBytes, bytesToBase64, base64ToBytes, bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import type { AttachmentMetadata, EncryptedAttachmentChunk } from '../src/attachments/types.ts';

describe('VEIL Phase 30: Complete File Attachment Pipeline', () => {
  let server: RelayServer;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;
  let serverUrl: string;

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
  });

  afterEach(async () => {
    await server.stop();
  });

  it('End-to-End File Exchange: Alice chunks, encrypts, uploads to R2, sends via Double Ratchet; Bob downloads, reassembles & decrypts perfectly', async () => {
    // 1. Setup Alice
    const clientAlice = new CloudClient(serverUrl);
    const storageAlice = new MemoryAdapter();
    const vaultAlice = new SpaceVaultManager();
    const storeAlice = new EncryptedSpaceStore(storageAlice);
    const idMgrAlice = new SpaceIdentityManager();
    const acctMgrAlice = new AccountManager(clientAlice, vaultAlice, idMgrAlice, storeAlice, storageAlice);

    const { session: sessionAlice, account: accountAlice } = await acctMgrAlice.registerAccount({
      username: 'alice_files',
      password: 'AlicePassword123!',
      spaceName: 'Alice Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const prekeyMgrAlice = new PrekeyManager(storeAlice, idMgrAlice);
    const convMgrAlice = new ConversationManager(storeAlice, idMgrAlice, prekeyMgrAlice);

    // 2. Setup Bob
    const clientBob = new CloudClient(serverUrl);
    const storageBob = new MemoryAdapter();
    const vaultBob = new SpaceVaultManager();
    const storeBob = new EncryptedSpaceStore(storageBob);
    const idMgrBob = new SpaceIdentityManager();
    const acctMgrBob = new AccountManager(clientBob, vaultBob, idMgrBob, storeBob, storageBob);

    const { session: sessionBob, account: accountBob } = await acctMgrBob.registerAccount({
      username: 'bob_files',
      password: 'BobPassword123!',
      spaceName: 'Bob Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const prekeyMgrBob = new PrekeyManager(storeBob, idMgrBob);
    const convMgrBob = new ConversationManager(storeBob, idMgrBob, prekeyMgrBob);
    const bobBundle = prekeyMgrBob.generatePrekeyBundle(sessionBob);

    // 3. Multi-chunk file payload (150 KiB crossing default 64 KiB chunk boundary)
    const originalPlaintext = new Uint8Array(150 * 1024);
    for (let i = 0; i < originalPlaintext.length; i++) {
      originalPlaintext[i] = i % 256;
    }
    const fileName = 'financial_audit_2026.pdf';
    const fileMime = 'application/pdf';

    // 4. Sender generates single-use ephemeral key and performs authenticated chunking
    const ephemeralKey = randomBytes(32);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      originalPlaintext,
      fileName,
      fileMime,
      ephemeralKey
    );

    expect(metadata.chunkCount).toBe(3); // 150 KiB / 64 KiB = 3 chunks
    expect(metadata.sizeBytes).toBe(originalPlaintext.length);

    // 5. Serialize ciphertext chunks into raw payload and hash
    const rawCiphertext = new TextEncoder().encode(JSON.stringify(chunks));
    const ciphertextHash = bytesToHex(sha256(rawCiphertext));

    // 6. Register attachment with recipient authorization
    const createRes = await clientAlice.createAttachment({
      attachmentId: metadata.attachmentId,
      spaceId: sessionAlice.spaceId,
      ciphertextSize: rawCiphertext.length,
      ciphertextHash,
      chunkCount: metadata.chunkCount,
      chunkSize: metadata.chunkSize,
      recipientUsername: 'bob_files',
      recipientAccountId: accountBob.accountId,
      encryptedMetadata: JSON.stringify({
        name: metadata.name,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        recipientUsername: 'bob_files',
        recipientAccountId: accountBob.accountId,
      }),
    });

    const objectId = createRes.attachment.objectId;
    expect(objectId).toMatch(/^obj_/);

    // 7. Upload ciphertext to R2 storage
    await clientAlice.uploadAttachment(objectId, rawCiphertext);

    // 8. Package attachment metadata into Double Ratchet wire payload
    const attachmentPayload = {
      attachmentId: metadata.attachmentId,
      objectId,
      name: metadata.name,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      chunkCount: metadata.chunkCount,
      chunkSize: metadata.chunkSize,
      sha256Hash: metadata.sha256Hash,
      ciphertextHash,
      encryptionKeyBase64: bytesToBase64(ephemeralKey),
    };

    const { wirePayloadBase64 } = await convMgrAlice.encryptAndPackWireMessage(
      sessionAlice,
      bobBundle,
      `📎 Attachment: ${fileName}`,
      attachmentPayload
    );

    // 9. Bob receives and unpacks Double Ratchet payload
    const inboundResult = await convMgrBob.processInboundWirePayload(sessionBob, wirePayloadBase64);
    expect(inboundResult.attachment).toBeDefined();
    expect(inboundResult.attachment?.objectId).toBe(objectId);
    expect(inboundResult.attachment?.name).toBe(fileName);
    expect(inboundResult.attachment?.encryptionKeyBase64).toBe(bytesToBase64(ephemeralKey));

    // 10. Bob downloads ciphertext from R2
    const bobDownloadedCiphertext = await clientBob.downloadAttachment(inboundResult.attachment!.objectId!);
    expect(bobDownloadedCiphertext).toEqual(rawCiphertext);

    // 11. Bob decrypts and reassembles all chunks
    const bobDecodedChunks: EncryptedAttachmentChunk[] = JSON.parse(new TextDecoder().decode(bobDownloadedCiphertext));
    const bobKey = base64ToBytes(inboundResult.attachment!.encryptionKeyBase64!);
    const bobMeta: AttachmentMetadata = {
      attachmentId: inboundResult.attachment!.attachmentId || objectId,
      name: inboundResult.attachment!.name,
      mimeType: inboundResult.attachment!.mimeType,
      sizeBytes: inboundResult.attachment!.sizeBytes,
      chunkCount: inboundResult.attachment!.chunkCount || bobDecodedChunks.length,
      chunkSize: inboundResult.attachment!.chunkSize || (64 * 1024),
      sha256Hash: inboundResult.attachment!.sha256Hash || '',
    };

    const reassembledPlaintext = AttachmentPipeline.decryptAndReassemble(bobMeta, bobDecodedChunks, bobKey);
    expect(reassembledPlaintext).toEqual(originalPlaintext);
  });

  it('Access Control: Unauthorized user receives 404 Access Denied when attempting to download another user attachment', async () => {
    // 1. Alice (Owner)
    const clientAlice = new CloudClient(serverUrl);
    const storageAlice = new MemoryAdapter();
    const vaultAlice = new SpaceVaultManager();
    const storeAlice = new EncryptedSpaceStore(storageAlice);
    const idMgrAlice = new SpaceIdentityManager();
    const acctMgrAlice = new AccountManager(clientAlice, vaultAlice, idMgrAlice, storeAlice, storageAlice);

    const { session: sessionAlice } = await acctMgrAlice.registerAccount({
      username: 'alice_secret',
      password: 'AlicePassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Eve (Unauthorized Attacker)
    const clientEve = new CloudClient(serverUrl);
    const storageEve = new MemoryAdapter();
    const vaultEve = new SpaceVaultManager();
    const storeEve = new EncryptedSpaceStore(storageEve);
    const idMgrEve = new SpaceIdentityManager();
    const acctMgrEve = new AccountManager(clientEve, vaultEve, idMgrEve, storeEve, storageEve);

    await acctMgrEve.registerAccount({
      username: 'eve_attacker',
      password: 'EvePassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 3. Alice uploads a document restricted to bob_secret
    const secretData = new Uint8Array([10, 20, 30, 40, 50]);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      secretData,
      'classified.txt',
      'text/plain',
      randomBytes(32)
    );
    const rawCiphertext = new TextEncoder().encode(JSON.stringify(chunks));
    const ciphertextHash = bytesToHex(sha256(rawCiphertext));

    const createRes = await clientAlice.createAttachment({
      attachmentId: metadata.attachmentId,
      spaceId: sessionAlice.spaceId,
      ciphertextSize: rawCiphertext.length,
      ciphertextHash,
      recipientUsername: 'bob_secret',
    });

    await clientAlice.uploadAttachment(createRes.attachment.objectId, rawCiphertext);

    // 4. Eve attempts download and is rejected
    await expect(clientEve.downloadAttachment(createRes.attachment.objectId)).rejects.toThrow(/not found|access denied/i);

    // 5. Alice (Sender/Owner) can download her own attachment
    const aliceDownloaded = await clientAlice.downloadAttachment(createRes.attachment.objectId);
    expect(aliceDownloaded).toEqual(rawCiphertext);
  });

  it('Integrity verification: Tampered chunk ciphertext throws on reassembly', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const key = randomBytes(32);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(data, 'doc.txt', 'text/plain', key);

    // Tamper with first chunk ciphertext
    const tamperedChunks = chunks.map((c) => ({
      ...c,
      ciphertext: bytesToBase64(new Uint8Array([99, 99, 99, 99])),
    }));

    expect(() => AttachmentPipeline.decryptAndReassemble(metadata, tamperedChunks, key)).toThrow();
  });

  it('Handles empty files (0 bytes) gracefully', async () => {
    const emptyData = new Uint8Array(0);
    const key = randomBytes(32);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(emptyData, 'empty.txt', 'text/plain', key);

    expect(metadata.sizeBytes).toBe(0);
    expect(metadata.chunkCount).toBe(1);

    const reassembled = AttachmentPipeline.decryptAndReassemble(metadata, chunks, key);
    expect(reassembled).toEqual(emptyData);
  });

  it('Unauthenticated request without Bearer token gets 401 Unauthorized', async () => {
    const unauthClient = new CloudClient(serverUrl);
    expect(unauthClient.getSessionToken()).toBeNull();

    await expect(unauthClient.downloadAttachment('obj_unauth_test')).rejects.toThrow(/unauthorized/i);
  });
});

