import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';
import { randomBytes, bytesToBase64, bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';

describe('Phase 41: End-to-End Real Two-Account Media Delivery Suite', () => {
  let server: RelayServer;
  let serverUrl: string;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;

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
    if (server) await server.stop();
  });

  it('delivers an encrypted photo from Account A to Account B over real HTTP transport without sender blob leakage', async () => {
    const storeA = new EncryptedSpaceStore(new MemoryAdapter());
    const storeB = new EncryptedSpaceStore(new MemoryAdapter());
    const idMgrA = new SpaceIdentityManager();
    const idMgrB = new SpaceIdentityManager();
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    // 1. Initialize Space A & Space B
    const sessionA = new SpaceSession('space_a', 'Alice Space', false, randomBytes(32));
    const sessionB = new SpaceSession('space_b', 'Bob Space', false, randomBytes(32));

    idMgrA.createIdentity(sessionA, storeA, 'Alice');
    idMgrB.createIdentity(sessionB, storeB, 'Bob');

    const bobPrekeyBundle = prekeyMgrB.createPrekeyBundle(sessionB);

    // 2. Initialize CloudClient for Alice & Bob
    const cloudA = new CloudClient(serverUrl);
    const cloudB = new CloudClient(serverUrl);

    const regA = await cloudA.registerAccount({
      username: 'alice41',
      password: 'AlicePassword123!',
      deviceId: 'dev_alice41',
    });
    cloudA.setSession(regA.session.sessionToken, regA.account.accountId, regA.device.deviceId);

    const regB = await cloudB.registerAccount({
      username: 'bob41',
      password: 'BobPassword123!',
      deviceId: 'dev_bob41',
    });
    cloudB.setSession(regB.session.sessionToken, regB.account.accountId, regB.device.deviceId);

    // 3. Alice selects a 128 KiB image
    const rawImageBytes = new Uint8Array(128 * 1024);
    for (let i = 0; i < rawImageBytes.length; i++) rawImageBytes[i] = (i * 17) & 0xff;
    const originalHash = bytesToHex(sha256(rawImageBytes));

    const ephemeralKey = randomBytes(32);
    const attachmentId = 'att_img_41';

    // Alice generates local preview (simulated)
    const localSenderPreview = 'blob:http://localhost:5173/alice-local-preview-only';

    // 4. Alice chunks and encrypts media locally (XChaCha20-Poly1305)
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      rawImageBytes,
      'sunset.jpg',
      'image/jpeg',
      ephemeralKey,
      undefined,
      attachmentId
    );

    const rawCiphertext = new TextEncoder().encode(JSON.stringify(chunks));
    const ciphertextHash = bytesToHex(sha256(rawCiphertext));

    // 5. Alice uploads ciphertext to R2/Cloud
    const createRes = await cloudA.createAttachment({
      attachmentId: metadata.attachmentId,
      spaceId: sessionA.spaceId,
      ciphertextSize: rawCiphertext.length,
      ciphertextHash,
      chunkCount: metadata.chunkCount,
      chunkSize: metadata.chunkSize,
      conversationId: sessionB.spaceId,
      encryptedMetadata: JSON.stringify({
        name: metadata.name,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        recipientAccountId: regB.account.accountId,
        recipientUsername: 'bob41',
        allowSave: true,
        allowForward: true,
      }),
    });

    const objectId = createRes.attachment.objectId;
    await cloudA.uploadAttachment(objectId, rawCiphertext);

    // 6. Alice packs wire message (with strict toWireAttachment)
    const localAttachmentState = {
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
      previewUrl: localSenderPreview,
      state: 'SENT' as const,
      allowSave: true,
      allowForward: true,
    };

    const { wirePayloadBase64 } = await convMgrA.encryptAndPackWireMessage(
      sessionA,
      bobPrekeyBundle,
      'Here is the sunset photo',
      localAttachmentState
    );

    // Verify wire payload NEVER contains Alice's local preview URL
    const wireJsonStr = Buffer.from(wirePayloadBase64, 'base64').toString('utf8');
    expect(wireJsonStr.includes('alice-local-preview-only')).toBe(false);
    expect(wireJsonStr.includes('blob:')).toBe(false);

    // 7. Bob receives and unpacks wire payload
    const inbound = await convMgrB.processInboundWirePayload(sessionB, wirePayloadBase64);
    expect(inbound.storedMessage.text).toBe('Here is the sunset photo');
    expect(inbound.attachment).toBeDefined();
    expect(inbound.attachment.attachmentId).toBe(attachmentId);
    expect(inbound.attachment.objectId).toBe(objectId);
    expect(inbound.attachment.previewUrl).toBeUndefined(); // Bob has NO sender blob URL

    // 8. Bob fetches ciphertext from R2 and decrypts locally into recipient RAM
    const bobDecrypted = await MediaCache.getOrFetch(inbound.attachment, sessionB, cloudB);
    expect(bobDecrypted).toBeDefined();
    expect(bobDecrypted.data.length).toBe(rawImageBytes.length);
    expect(bytesToHex(sha256(bobDecrypted.data))).toBe(originalHash);

    // Bob has his own recipient-owned blobUrl
    expect(bobDecrypted.blobUrl).toBeDefined();
    expect(bobDecrypted.mimeType).toBe('image/jpeg');
  });

  it('delivers an encrypted video and multi-media grouped message to Bob', async () => {
    const storeA = new EncryptedSpaceStore(new MemoryAdapter());
    const storeB = new EncryptedSpaceStore(new MemoryAdapter());
    const idMgrA = new SpaceIdentityManager();
    const idMgrB = new SpaceIdentityManager();
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    const sessionA = new SpaceSession('space_a2', 'Alice Space 2', false, randomBytes(32));
    const sessionB = new SpaceSession('space_b2', 'Bob Space 2', false, randomBytes(32));

    idMgrA.createIdentity(sessionA, storeA, 'Alice2');
    idMgrB.createIdentity(sessionB, storeB, 'Bob2');

    const bobPrekeyBundle = prekeyMgrB.createPrekeyBundle(sessionB);

    const cloudA = new CloudClient(serverUrl);
    const cloudB = new CloudClient(serverUrl);

    const regA = await cloudA.registerAccount({
      username: 'alice41_2',
      password: 'AlicePassword123!',
      deviceId: 'dev_alice41_2',
    });
    cloudA.setSession(regA.session.sessionToken, regA.account.accountId, regA.device.deviceId);

    const regB = await cloudB.registerAccount({
      username: 'bob41_2',
      password: 'BobPassword123!',
      deviceId: 'dev_bob41_2',
    });
    cloudB.setSession(regB.session.sessionToken, regB.account.accountId, regB.device.deviceId);

    // Alice encrypts 2 attachments (1 image, 1 video)
    const imgBytes = new Uint8Array(64 * 1024).fill(0xaa);
    const vidBytes = new Uint8Array(128 * 1024).fill(0xbb);

    const key1 = randomBytes(32);
    const key2 = randomBytes(32);

    const { metadata: meta1, chunks: chunks1 } = AttachmentPipeline.chunkAndEncrypt(imgBytes, 'img.png', 'image/png', key1);
    const { metadata: meta2, chunks: chunks2 } = AttachmentPipeline.chunkAndEncrypt(vidBytes, 'vid.mp4', 'video/mp4', key2);

    const ct1 = new TextEncoder().encode(JSON.stringify(chunks1));
    const ct2 = new TextEncoder().encode(JSON.stringify(chunks2));

    const res1 = await cloudA.createAttachment({
      attachmentId: meta1.attachmentId,
      spaceId: sessionA.spaceId,
      ciphertextSize: ct1.length,
      ciphertextHash: bytesToHex(sha256(ct1)),
      chunkCount: meta1.chunkCount,
      chunkSize: meta1.chunkSize,
      conversationId: sessionB.spaceId,
      encryptedMetadata: JSON.stringify({
        name: meta1.name,
        mimeType: meta1.mimeType,
        sizeBytes: meta1.sizeBytes,
        recipientAccountId: regB.account.accountId,
        recipientUsername: 'bob41_2',
      }),
    });
    await cloudA.uploadAttachment(res1.attachment.objectId, ct1);

    const res2 = await cloudA.createAttachment({
      attachmentId: meta2.attachmentId,
      spaceId: sessionA.spaceId,
      ciphertextSize: ct2.length,
      ciphertextHash: bytesToHex(sha256(ct2)),
      chunkCount: meta2.chunkCount,
      chunkSize: meta2.chunkSize,
      conversationId: sessionB.spaceId,
      encryptedMetadata: JSON.stringify({
        name: meta2.name,
        mimeType: meta2.mimeType,
        sizeBytes: meta2.sizeBytes,
        recipientAccountId: regB.account.accountId,
        recipientUsername: 'bob41_2',
      }),
    });
    await cloudA.uploadAttachment(res2.attachment.objectId, ct2);

    const groupAttachments = [
      {
        attachmentId: meta1.attachmentId,
        objectId: res1.attachment.objectId,
        name: meta1.name,
        mimeType: meta1.mimeType,
        sizeBytes: meta1.sizeBytes,
        chunkCount: meta1.chunkCount,
        chunkSize: meta1.chunkSize,
        sha256Hash: meta1.sha256Hash,
        ciphertextHash: bytesToHex(sha256(ct1)),
        encryptionKeyBase64: bytesToBase64(key1),
      },
      {
        attachmentId: meta2.attachmentId,
        objectId: res2.attachment.objectId,
        name: meta2.name,
        mimeType: meta2.mimeType,
        sizeBytes: meta2.sizeBytes,
        chunkCount: meta2.chunkCount,
        chunkSize: meta2.chunkSize,
        sha256Hash: meta2.sha256Hash,
        ciphertextHash: bytesToHex(sha256(ct2)),
        encryptionKeyBase64: bytesToBase64(key2),
      },
    ];

    const { wirePayloadBase64 } = await convMgrA.encryptAndPackWireMessage(
      sessionA,
      bobPrekeyBundle,
      '',
      undefined,
      undefined,
      undefined,
      groupAttachments
    );

    const inbound = await convMgrB.processInboundWirePayload(sessionB, wirePayloadBase64);
    expect(inbound.attachments).toBeDefined();
    expect(inbound.attachments!.length).toBe(2);

    // Bob decrypts the video from the group
    const bobVideo = await MediaCache.getOrFetch(inbound.attachments![1], sessionB, cloudB);
    expect(bobVideo.mimeType).toBe('video/mp4');
    expect(bobVideo.data.length).toBe(vidBytes.length);
    expect(bytesToHex(sha256(bobVideo.data))).toBe(bytesToHex(sha256(vidBytes)));
  });
});
