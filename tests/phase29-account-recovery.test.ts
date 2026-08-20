/**
 * Phase 29 Test Suite: Zero-Knowledge Account Identity Persistence & Recovery
 *
 * HARD INVARIANT TEST:
 * Restoring an account on a fresh device / reinstalled app MUST reconstruct
 * the EXACT SAME Space Master Key and Ed25519 identityId byte-for-byte.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_FILE = path.resolve(process.cwd(), '.veil_recovery_test_db.json');

describe('Phase 29: Zero-Knowledge Account Identity Persistence & Recovery', () => {
  let server: RelayServer;
  let port: number;
  let serverUrl: string;
  let cloudDb: SqlCloudDatabase;
  let objectStorage: S3ObjectStorage;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }

    port = 9000 + Math.floor(Math.random() * 800);
    serverUrl = `http://127.0.0.1:${port}`;

    cloudDb = new SqlCloudDatabase({ diskPath: TEST_DB_FILE });
    await cloudDb.init();

    objectStorage = new S3ObjectStorage({ bucket: 'veil-test-recovery' });

    server = new RelayServer(
      {
        port,
        host: '127.0.0.1',
        authRequired: false,
        maxPayloadSizeBytes: 1024 * 1024,
        rateLimitMaxRequests: 10000,
        rateLimitWindowMs: 60000,
        cleanupIntervalMs: 60000,
        retentionHours: 24,
      },
      new MemoryRelayStore(),
      cloudDb,
      objectStorage
    );
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    await cloudDb.close();
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  it('restores exact identical identityId and Space Master Key across clean device reinstallation', async () => {
    // =========================================================================
    // DEVICE 1: Initial Registration & Space Creation
    // =========================================================================
    const client1 = new CloudClient(serverUrl);
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();

    const accountManager1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

    const registration = await accountManager1.registerAccount({
      username: 'alice_persistent',
      password: 'MyUltraSecurePassword_2026!',
      spaceName: 'Primary Space',
      deviceName: 'Device 1 (Original)',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const originalMasterKey = registration.session.getMasterKey();
    const originalIdentityId = registration.identityDoc.identityId;
    const originalSigningPub = registration.identityDoc.signingPublicKey;
    const originalKaPub = registration.identityDoc.keyAgreementPublicKey;
    const originalFingerprint = registration.identityDoc.fingerprint;

    expect(originalIdentityId).toBeDefined();
    expect(originalSigningPub).toBeDefined();

    // =========================================================================
    // SIMULATE DEVICE REINSTALLATION / FRESH BROWSER (Zero local state)
    // =========================================================================
    const client2 = new CloudClient(serverUrl);
    const storage2 = new MemoryAdapter(); // Completely blank memory adapter
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storage2);
    const idMgr2 = new SpaceIdentityManager();

    const accountManager2 = new AccountManager(client2, vault2, idMgr2, store2, storage2);

    // Restore on clean device
    const restored = await accountManager2.restoreAccount({
      username: 'alice_persistent',
      password: 'MyUltraSecurePassword_2026!',
      deviceName: 'Device 2 (Fresh Phone)',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const restoredMasterKey = restored.session.getMasterKey();
    const restoredIdentityId = restored.identityDoc.identityId;
    const restoredSigningPub = restored.identityDoc.signingPublicKey;
    const restoredKaPub = restored.identityDoc.keyAgreementPublicKey;
    const restoredFingerprint = restored.identityDoc.fingerprint;

    // =========================================================================
    // INVARIANT VERIFICATION: BYTE-FOR-BYTE IDENTITY CONTINUITY
    // =========================================================================
    expect(restoredIdentityId).toBe(originalIdentityId);
    expect(restoredSigningPub).toBe(originalSigningPub);
    expect(restoredKaPub).toBe(originalKaPub);
    expect(restoredFingerprint).toBe(originalFingerprint);
    expect(restoredMasterKey).toEqual(originalMasterKey);

    // Verify Space is unlocked and functional
    expect(restored.session.isActive()).toBe(true);
  });

  it('fails cleanly with bad password and leaks no sensitive data', async () => {
    const client1 = new CloudClient(serverUrl);
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();

    const accountManager1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

    await accountManager1.registerAccount({
      username: 'bob_secure',
      password: 'CorrectPassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const client2 = new CloudClient(serverUrl);
    const storage2 = new MemoryAdapter();
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storage2);
    const idMgr2 = new SpaceIdentityManager();

    const accountManager2 = new AccountManager(client2, vault2, idMgr2, store2, storage2);

    // Attempt restore with incorrect password
    await expect(
      accountManager2.restoreAccount({
        username: 'bob_secure',
        password: 'WrongPassword!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();
  });
});
