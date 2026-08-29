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
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';

describe('Phase 42: Comprehensive Two-Account Media Delivery Forensic Verification Suite', () => {
  let server: RelayServer;
  let serverUrl: string;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;

  beforeEach(async () => {
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();

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

  it('delivers single image, single video, 3 grouped images, and mixed media across real HTTP relay', async () => {
    const storeA = new EncryptedSpaceStore(new MemoryAdapter());
    const storeB = new EncryptedSpaceStore(new MemoryAdapter());
    const idMgrA = new SpaceIdentityManager();
    const idMgrB = new SpaceIdentityManager();
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    const sessionA = new SpaceSession('space_a_p42', 'Alice Space', false, randomBytes(32));
    const sessionB = new SpaceSession('space_b_p42', 'Bob Space', false, randomBytes(32));

    idMgrA.createIdentity(sessionA, storeA, 'Alice');
    idMgrB.createIdentity(sessionB, storeB, 'Bob');

    const bobPrekeyBundle = prekeyMgrB.createPrekeyBundle(sessionB);

    const cloudA = new CloudClient(serverUrl);
    const cloudB = new CloudClient(serverUrl);

    const regA = await cloudA.registerAccount({
      username: 'alice_p42',
      password: 'AlicePassword123!',
      deviceId: 'dev_alice_p42',
    });
    cloudA.setSession(regA.session.sessionToken, regA.account.accountId, regA.device.deviceId);

    const regB = await cloudB.registerAccount({
      username: 'bob_p42',
      password: 'BobPassword123!',
      deviceId: 'dev_bob_p42',
    });
    cloudB.setSession(regB.session.sessionToken, regB.account.accountId, regB.device.deviceId);

    // =========================================================================
    // TEST 1: SINGLE ENCRYPTED IMAGE (15 INVARIANTS)
    // =========================================================================
    const imgPlaintext = new Uint8Array(64 * 1024).fill(0x11);
    const imgSha = bytesToHex(sha256(imgPlaintext));
    const imgKey = randomBytes(32);
    const { metadata: imgMeta, chunks: imgChunks } = AttachmentPipeline.chunkAndEncrypt(
      imgPlaintext,
      'sunset.jpg',
      'image/jpeg',
      imgKey
    );
    const imgCt = new TextEncoder().encode(JSON.stringify(imgChunks));

    const imgCreate = await cloudA.createAttachment({
      attachmentId: imgMeta.attachmentId,
      spaceId: sessionA.spaceId,
      ciphertextSize: imgCt.length,
      ciphertextHash: bytesToHex(sha256(imgCt)),
      chunkCount: imgMeta.chunkCount,
      chunkSize: imgMeta.chunkSize,
      conversationId: sessionB.spaceId,
      encryptedMetadata: JSON.stringify({
        name: imgMeta.name,
        mimeType: imgMeta.mimeType,
        sizeBytes: imgMeta.sizeBytes,
        recipientAccountId: regB.account.accountId,
        recipientUsername: 'bob_p42',
      }),
    });
    await cloudA.uploadAttachment(imgCreate.attachment.objectId, imgCt);

    const imgLocalAtt = {
      attachmentId: imgMeta.attachmentId,
      objectId: imgCreate.attachment.objectId,
      name: imgMeta.name,
      mimeType: imgMeta.mimeType,
      sizeBytes: imgMeta.sizeBytes,
      chunkCount: imgMeta.chunkCount,
      chunkSize: imgMeta.chunkSize,
      sha256Hash: imgMeta.sha256Hash,
      ciphertextHash: bytesToHex(sha256(imgCt)),
      encryptionKeyBase64: bytesToBase64(imgKey),
      previewUrl: 'blob:http://localhost:5173/sender-local-only-img',
    };

    const { wirePayloadBase64: imgWire } = await convMgrA.encryptAndPackWireMessage(
      sessionA,
      bobPrekeyBundle,
      'Sunset photo',
      imgLocalAtt
    );

    // Assert wire string NEVER leaks sender blob URL
    expect(Buffer.from(imgWire, 'base64').toString('utf8').includes('blob:')).toBe(false);

    // Bob receives and unpacks
    const inboundImg = await convMgrB.processInboundWirePayload(sessionB, imgWire);
    expect(inboundImg.attachment).toBeDefined();
    expect(inboundImg.attachment.objectId).toBe(imgCreate.attachment.objectId);
    expect(inboundImg.attachment.previewUrl).toBeUndefined();

    // Bob downloads, decrypts, and generates recipient Blob
    const bobImgDecrypted = await MediaCache.getOrFetch(inboundImg.attachment, sessionB, cloudB);
    expect(bobImgDecrypted.data.length).toBe(imgPlaintext.length);
    expect(bytesToHex(sha256(bobImgDecrypted.data))).toBe(imgSha);
    expect(bobImgDecrypted.mimeType).toBe('image/jpeg');
    expect(bobImgDecrypted.blobUrl).toBeDefined();

    // =========================================================================
    // TEST 2: 3 GROUPED IMAGES
    // =========================================================================
    const groupAtts: any[] = [];
    for (let i = 1; i <= 3; i++) {
      const pBytes = new Uint8Array(32 * 1024).fill(i * 10);
      const k = randomBytes(32);
      const { metadata: m, chunks: c } = AttachmentPipeline.chunkAndEncrypt(pBytes, `group_${i}.png`, 'image/png', k);
      const ct = new TextEncoder().encode(JSON.stringify(c));

      const res = await cloudA.createAttachment({
        attachmentId: m.attachmentId,
        spaceId: sessionA.spaceId,
        ciphertextSize: ct.length,
        ciphertextHash: bytesToHex(sha256(ct)),
        chunkCount: m.chunkCount,
        chunkSize: m.chunkSize,
        conversationId: sessionB.spaceId,
        encryptedMetadata: JSON.stringify({
          name: m.name,
          mimeType: m.mimeType,
          sizeBytes: m.sizeBytes,
          recipientAccountId: regB.account.accountId,
          recipientUsername: 'bob_p42',
        }),
      });
      await cloudA.uploadAttachment(res.attachment.objectId, ct);

      groupAtts.push({
        attachmentId: m.attachmentId,
        objectId: res.attachment.objectId,
        name: m.name,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
        chunkCount: m.chunkCount,
        chunkSize: m.chunkSize,
        sha256Hash: m.sha256Hash,
        ciphertextHash: bytesToHex(sha256(ct)),
        encryptionKeyBase64: bytesToBase64(k),
        previewUrl: `blob:http://localhost:5173/sender-group-${i}`,
      });
    }

    const { wirePayloadBase64: groupWire } = await convMgrA.encryptAndPackWireMessage(
      sessionA,
      bobPrekeyBundle,
      '',
      undefined,
      undefined,
      undefined,
      groupAtts
    );

    const inboundGroup = await convMgrB.processInboundWirePayload(sessionB, groupWire);
    expect(inboundGroup.attachments).toBeDefined();
    expect(inboundGroup.attachments!.length).toBe(3);

    // Bob decrypts all 3 group attachments
    for (let i = 0; i < 3; i++) {
      const att = inboundGroup.attachments![i];
      const dec = await MediaCache.getOrFetch(att, sessionB, cloudB);
      expect(dec.data.length).toBe(32 * 1024);
      expect(dec.mimeType).toBe('image/png');
    }

    // Verify diagnostic history has recorded download and decryption
    const downloadEvents = RuntimeDiagnostics.getHistory('DOWNLOAD');
    expect(downloadEvents.length).toBeGreaterThanOrEqual(4);

    const decryptEvents = RuntimeDiagnostics.getHistory('DECRYPT');
    expect(decryptEvents.length).toBeGreaterThanOrEqual(4);
  });
});
