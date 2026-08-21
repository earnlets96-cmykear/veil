import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToHex, randomBytes } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import * as http from 'http';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { CloudHandler } from '../src/server/cloud/cloudHandler.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 30: Auto Cloud Session Provisioning & Self-Healing', () => {
  let server: http.Server;
  let serverUrl: string;
  let db: MemoryCloudDatabase;
  let storage: LocalDiskObjectStorage;
  let tempStorageDir: string;
  let vault: SpaceVaultManager;
  let idMgr: SpaceIdentityManager;
  let store: EncryptedSpaceStore;

  beforeEach(async () => {
    tempStorageDir = path.join(process.cwd(), `.veil_auto_session_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    fs.mkdirSync(tempStorageDir, { recursive: true });

    db = new MemoryCloudDatabase();
    await db.init();
    storage = new LocalDiskObjectStorage(tempStorageDir);
    await storage.init();

    const handler = new CloudHandler(db, storage);
    server = http.createServer(async (req, res) => {
      const handled = await handler.handleRequest(req, res);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    vault = new SpaceVaultManager();
    idMgr = new SpaceIdentityManager();
    store = new EncryptedSpaceStore();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fs.existsSync(tempStorageDir)) {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    }
  });

  it('AUTO-PROVISIONING: Automatically logs in or registers cloud session when session token is missing', async () => {
    const spaceHeader = vault.createSpace({
      name: 'Alice Space',
      password: 'alice-strong-passphrase',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const session = vault.unlockSpace('alice-strong-passphrase', spaceHeader.spaceId);
    const identityDoc = idMgr.createIdentity(session, store);
    const client = new CloudClient(serverUrl);

    expect(client.getSessionToken()).toBeNull();

    // Simulated ensureCloudSession helper logic
    const ensureSession = async () => {
      if (client.getSessionToken()) return;
      const username = 'alice';
      const authPassword = bytesToHex(sha256(session.getMasterKey()));
      const deviceId = `dev_${identityDoc.identityId.slice(0, 12)}`;

      try {
        const logRes = await client.loginAccount({ username, password: authPassword, deviceId });
        await store.setAsync(session, 'veil:cloud:session', {
          sessionToken: logRes.session.sessionToken,
          accountId: logRes.account.accountId,
          deviceId: logRes.device.deviceId,
          expiresAt: logRes.session.expiresAt,
          username,
        });
      } catch (_loginErr) {
        const regRes = await client.registerAccount({
          username,
          password: authPassword,
          deviceId,
          deviceName: session.name,
          deviceSigningPub: identityDoc.signingPublicKey,
          deviceKeyAgreementPub: identityDoc.keyAgreementPublicKey,
        });
        await store.setAsync(session, 'veil:cloud:session', {
          sessionToken: regRes.session.sessionToken,
          accountId: regRes.account.accountId,
          deviceId: regRes.device.deviceId,
          expiresAt: regRes.session.expiresAt,
          username,
        });
      }
    };

    // First call auto-registers
    await ensureSession();
    expect(client.getSessionToken()).toBeTruthy();
    expect(client.getAccountId()).toBeTruthy();

    const savedSession = await store.getAsync<any>(session, 'veil:cloud:session');
    expect(savedSession).not.toBeNull();
    expect(savedSession.sessionToken).toBe(client.getSessionToken());
    expect(savedSession.username).toBe('alice');

    // Reset memory client and verify subsequent ensureSession auto-restores or logs in
    const client2 = new CloudClient(serverUrl);
    expect(client2.getSessionToken()).toBeNull();

    // Load from store
    const restored = await store.getAsync<any>(session, 'veil:cloud:session');
    if (restored && restored.expiresAt > Date.now()) {
      client2.setSession(restored.sessionToken, restored.accountId, restored.deviceId);
    }
    expect(client2.getSessionToken()).toBe(savedSession.sessionToken);
  });

  it('ATTACHMENT DOWNLOAD SELF-HEALING: Self-heals session before downloading attachment from cloud storage', async () => {
    // 1. Setup Alice (uploader) and Bob (recipient)
    const aliceHeader = vault.createSpace({ name: 'Alice Space', password: 'alice-password', kdfParams: FAST_TEST_KDF_PARAMS });
    const aliceSession = vault.unlockSpace('alice-password', aliceHeader.spaceId);
    const aliceId = idMgr.createIdentity(aliceSession, store);
    const aliceClient = new CloudClient(serverUrl);

    const bobHeader = vault.createSpace({ name: 'Bob Space', password: 'bob-password', kdfParams: FAST_TEST_KDF_PARAMS });
    const bobSession = vault.unlockSpace('bob-password', bobHeader.spaceId);
    const bobId = idMgr.createIdentity(bobSession, store);
    const bobClient = new CloudClient(serverUrl);

    // Register Bob on cloud
    const bobReg = await bobClient.registerAccount({
      username: 'bob',
      password: bytesToHex(sha256(bobSession.getMasterKey())),
      deviceId: `dev_${bobId.identityId.slice(0, 12)}`,
    });

    // Register Alice on cloud
    const aliceReg = await aliceClient.registerAccount({
      username: 'alice',
      password: bytesToHex(sha256(aliceSession.getMasterKey())),
      deviceId: `dev_${aliceId.identityId.slice(0, 12)}`,
    });

    // Alice uploads attachment authorized for Bob
    const payloadBytes = new TextEncoder().encode('SECRET_ENCRYPTED_ATTACHMENT_BYTES');
    const createRes = await aliceClient.createAttachment({
      attachmentId: 'att_test_123',
      spaceId: aliceSession.spaceId,
      ciphertextSize: payloadBytes.length,
      ciphertextHash: bytesToHex(sha256(payloadBytes)),
      recipientUsername: 'bob',
      recipientAccountId: bobReg.account.accountId,
      encryptedMetadata: JSON.stringify({ name: 'document.pdf', sizeBytes: payloadBytes.length }),
    });

    await aliceClient.uploadAttachment(createRes.attachment.objectId, payloadBytes);

    // 2. Clear Bob client's in-memory session (simulating page reload / fresh state)
    bobClient.setSession(null, null, null);
    expect(bobClient.getSessionToken()).toBeNull();

    // 3. Simulated self-healing download handler
    const downloadWithSelfHealing = async (objectId: string) => {
      if (!bobClient.getSessionToken()) {
        const authPassword = bytesToHex(sha256(bobSession.getMasterKey()));
        const deviceId = `dev_${bobId.identityId.slice(0, 12)}`;
        await bobClient.loginAccount({ username: 'bob', password: authPassword, deviceId });
      }
      return await bobClient.downloadAttachment(objectId);
    };

    const downloadedBytes = await downloadWithSelfHealing(createRes.attachment.objectId);
    expect(downloadedBytes).toEqual(payloadBytes);
  });
});
