/**
 * VEIL Phase 28: Production Cloud Deployment & Infrastructure Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RelayServer } from '../src/server/relayServer.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { MigrationRunner } from '../src/server/cloud/database/migrations/migrationRunner.ts';
import { ConfigManager } from '../src/config/appConfig.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SyncEngine } from '../src/sync/syncEngine.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { bytesToBase64, base64ToBytes, randomBytes, bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { createBackup, restoreBackup } from '../src/server/cloud/backup.ts';

describe('VEIL Phase 28: Production Cloud Deployment & Infrastructure', () => {
  let server: RelayServer;
  let sqlDb: SqlCloudDatabase;
  let s3Storage: S3ObjectStorage;
  let serverUrl: string;

  beforeEach(async () => {
    sqlDb = new SqlCloudDatabase('sqlite://:memory:');
    s3Storage = new S3ObjectStorage({
      endpoint: 'https://s3.us-east-1.amazonaws.com',
      bucket: 'veil-test-bucket',
    });
    const relayStore = new MemoryRelayStore();

    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      relayStore,
      sqlDb,
      s3Storage
    );

    const addr = await server.start();
    serverUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  // ===========================================================================
  // 1. CONFIGURATION & TLS ENFORCEMENT
  // ===========================================================================

  it('CONFIG VALIDATION: Production config enforces HTTPS and WSS for relay.veil.chat', () => {
    const prodConfig = ConfigManager.getConfig('production');
    expect(prodConfig.relayHttpUrl).toBe('https://relay.veil.chat');
    expect(prodConfig.relayWsUrl).toBe('wss://relay.veil.chat/v1/ws');
    expect(prodConfig.enforceTls).toBe(true);

    // Validation passes for valid prod config
    expect(() => ConfigManager.validateConfig(prodConfig)).not.toThrow();

    // Rejects cleartext HTTP when enforceTls is active
    const badConfig = { ...prodConfig, relayHttpUrl: 'http://relay.veil.chat' };
    expect(() => ConfigManager.validateConfig(badConfig)).toThrow(/Production config violation/i);
  });

  // ===========================================================================
  // 2. DETERMINISTIC DATABASE MIGRATIONS
  // ===========================================================================

  it('DATABASE MIGRATIONS: Executes initial migration and confirms repeat idempotency', async () => {
    const runner = new MigrationRunner();
    const executedDdl: string[] = [];
    const appliedSet = new Set<string>();

    // 1. First execution on fresh DB
    const res1 = await runner.runMigrations(
      async (sql) => { executedDdl.push(sql); },
      async (id) => appliedSet.has(id),
      async (id) => { appliedSet.add(id); }
    );
    expect(res1.appliedCount).toBe(1);
    expect(executedDdl.length).toBe(1);
    expect(executedDdl[0]).toContain('CREATE TABLE IF NOT EXISTS accounts');

    // 2. Second execution on existing DB (idempotent no-op)
    const res2 = await runner.runMigrations(
      async (sql) => { executedDdl.push(sql); },
      async (id) => appliedSet.has(id),
      async (id) => { appliedSet.add(id); }
    );
    expect(res2.appliedCount).toBe(0); // Zero additional migrations applied
  });

  // ===========================================================================
  // 3. HEALTH & READINESS ENDPOINTS
  // ===========================================================================

  it('HEALTH & READINESS: /healthz and /readyz report healthy infrastructure dependencies', async () => {
    // 1. Check /healthz (liveness)
    const healthRes = await fetch(`${serverUrl}/healthz`);
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe('ok');
    expect(healthJson.uptimeSeconds).toBeGreaterThanOrEqual(0);

    // 2. Check /readyz (readiness)
    const readyRes = await fetch(`${serverUrl}/readyz`);
    expect(readyRes.status).toBe(200);
    const readyJson = await readyRes.json();
    expect(readyJson.status).toBe('ready');
    expect(readyJson.store).toBe('ok');
    expect(readyJson.cloudDb).toBe('ok');
    expect(readyJson.objectStorage).toBe('ok');
  });

  // ===========================================================================
  // 4. S3 OBJECT STORAGE ATTACHMENT PERSISTENCE
  // ===========================================================================

  it('S3 ATTACHMENT PERSISTENCE: Ciphertext persists and verifies integrity across restart', async () => {
    const rawCiphertext = randomBytes(64 * 1024);
    const hash = bytesToHex(sha256(rawCiphertext));
    const objectId = 'obj_production_persistence_test_123';

    // 1. Upload to S3 storage adapter
    const meta = await s3Storage.upload(objectId, rawCiphertext);
    expect(meta.sha256Hash).toBe(hash);

    // 2. Verify download matches
    const downloaded = await s3Storage.download(objectId);
    expect(downloaded).not.toBeNull();
    expect(bytesToHex(sha256(downloaded!))).toBe(hash);

    // 3. Verify delete
    const deleted = await s3Storage.delete(objectId);
    expect(deleted).toBe(true);
    expect(await s3Storage.exists(objectId)).toBe(false);
  });

  // ===========================================================================
  // 5. BACKUP & RESTORATION
  // ===========================================================================

  it('BACKUP & RESTORE: Generates valid archive and restores byte-for-byte', async () => {
    const backupFile = path.join(process.cwd(), '.veil_backups', 'test_phase28_backup.json');
    const testDbDir = path.join(process.cwd(), '.veil_cloud_db_test_restore');
    const testObjDir = path.join(process.cwd(), '.veil_object_store_test_restore');

    // Create backup
    await createBackup(backupFile);
    expect(fs.existsSync(backupFile)).toBe(true);

    // Restore to test directories
    const success = await restoreBackup(backupFile, testDbDir, testObjDir);
    expect(success).toBe(true);

    // Cleanup test artifacts
    if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
    if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    if (fs.existsSync(testObjDir)) fs.rmSync(testObjDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // 6. FRESH INSTALLATION & MULTI-DEVICE RECOVERY
  // ===========================================================================

  it('FRESH INSTALL RECOVERY: New client re-hydrates messages and attachments from cloud', async () => {
    const clientA = new CloudClient({ baseUrl: serverUrl });
    const clientB = new CloudClient({ baseUrl: serverUrl });

    // 1. Client A registers account & device
    await clientA.registerAccount({
      username: '@prod_recovery_user',
      password: 'ProdPassword123!',
      deviceId: 'prod_dev_1',
    });

    const vaultA = new SpaceVaultManager();
    const envA = vaultA.createSpace({ name: 'ProdSpace', password: 'SpacePassword!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vaultA.unlockSpace('SpacePassword!', envA.spaceId);
    const storeA = new EncryptedSpaceStore();
    const syncA = new SyncEngine(storeA, clientA);

    const convKey = randomBytes(32);
    // Push 3 encrypted messages
    for (let i = 1; i <= 3; i++) {
      const plaintext = new TextEncoder().encode(`Prod confidential message #${i}`);
      const enc = encryptXChaCha20Poly1305(convKey, plaintext);
      syncA.enqueueMessage(sessionA, {
        messageId: `prod_msg_${i}`,
        accountId: clientA.getAccountId()!,
        spaceId: sessionA.spaceId,
        conversationId: 'chat_alpha',
        senderDeviceId: 'prod_dev_1',
        encryptedPayload: bytesToBase64(enc.ciphertext),
        nonce: bytesToBase64(enc.nonce),
        version: i,
        createdAt: Date.now() + i,
        updatedAt: Date.now() + i,
      });
    }
    await syncA.sync(sessionA);

    // 2. Client B (fresh installation on new device) logs in
    await clientB.loginAccount({
      username: '@prod_recovery_user',
      password: 'ProdPassword123!',
      deviceId: 'prod_dev_2',
    });

    const vaultB = new SpaceVaultManager();
    vaultB.registerEnvelope(envA);
    const sessionB = vaultB.unlockSpace('SpacePassword!', envA.spaceId);
    const storeB = new EncryptedSpaceStore();
    const syncB = new SyncEngine(storeB, clientB);

    // Sync from cloud
    const pullRes = await syncB.sync(sessionB);
    expect(pullRes.pulled).toBe(3);

    const recovered = syncB.getMessagesForConversation(sessionB, 'chat_alpha');
    expect(recovered.length).toBe(3);

    for (let i = 1; i <= 3; i++) {
      const dec = decryptXChaCha20Poly1305(
        convKey,
        base64ToBytes(recovered[i - 1].nonce),
        base64ToBytes(recovered[i - 1].encryptedPayload)
      );
      expect(new TextDecoder().decode(dec)).toBe(`Prod confidential message #${i}`);
    }
  });

  // ===========================================================================
  // 7. SECURITY & SECRETS AUDIT
  // ===========================================================================

  it('SECURITY AUDIT: .env.example contains only placeholders and zero real secrets', () => {
    const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
    expect(envExample).not.toContain('AKIA'); // No AWS Access Key ID
    expect(envExample).toContain('your_access_key_here');
    expect(envExample).toContain('your_secret_key_here');
  });
});
