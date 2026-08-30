/**
 * Phase 45: Real-Runtime Account Recovery & Username Normalization Test Suite.
 *
 * Verifies:
 * 1. Username normalization (trim, lowercase, @ strip) across registration, login, and recovery.
 * 2. Complete account restoration from clean empty local storage.
 * 3. Recovery of Space Master Keys and Space Envelopes.
 * 4. Rejection of invalid credentials.
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

describe('Phase 45: Account Recovery & Username Normalization Runtime', () => {
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
    if (server) {
      await server.stop();
    }
  });

  it('handles username normalization (@, uppercase, whitespace) consistently across registration and login', async () => {
    const client = new CloudClient(serverUrl);

    // Register with mixed case and leading @
    const regRes = await client.registerAccount({
      username: '  @Charlie_Dev  ',
      password: 'SafePassword123!',
      deviceId: 'dev_c1',
    });

    expect(regRes.account.username).toBe('charlie_dev');

    // Login with different case, no @, different whitespace
    const logRes = await client.loginAccount({
      username: 'CHARLIE_DEV',
      password: 'SafePassword123!',
      deviceId: 'dev_c2',
    });

    expect(logRes.account.username).toBe('charlie_dev');
    expect(logRes.session.sessionToken).toBeDefined();
  });

  it('restores account and space envelopes from fresh empty local storage after reinstall', async () => {
    // 1. Device 1: Register and create space
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();
    const cloud1 = new CloudClient(serverUrl);
    const accMgr1 = new AccountManager(cloud1, vault1, idMgr1, store1, storage1);

    const { session: origSession, identityDoc: origDoc } = await accMgr1.registerAccount({
      username: '@dagmawi',
      password: 'MySecretPassword123!',
      spaceName: 'Personal',
      deviceId: 'dev_d1',
    });

    expect(origSession).toBeDefined();
    expect(origDoc).toBeDefined();

    // 2. Device 2 (Simulating clean install with empty memory adapter)
    const storage2 = new MemoryAdapter();
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storage2);
    const idMgr2 = new SpaceIdentityManager();
    const cloud2 = new CloudClient(serverUrl);
    const accMgr2 = new AccountManager(cloud2, vault2, idMgr2, store2, storage2);

    // Verify local storage 2 is empty
    expect(vault2.listEnvelopes().length).toBe(0);

    // Restore using credentials with mixed case
    const { session: restoredSession, identityDoc: restoredDoc } = await accMgr2.restoreAccount({
      username: 'DAGMAWI',
      password: 'MySecretPassword123!',
    });

    // Verify restored space session
    expect(restoredSession.spaceId).toBe(origSession.spaceId);
    expect(vault2.listEnvelopes().length).toBeGreaterThanOrEqual(1);

    // Verify restored identity document
    expect(restoredDoc.identityId).toBe(origDoc.identityId);
    expect(restoredDoc.signingPublicKey).toBe(origDoc.signingPublicKey);
    expect(restoredDoc.keyAgreementPublicKey).toBe(origDoc.keyAgreementPublicKey);
  }, 60000);

  it('fails recovery gracefully with invalid password', async () => {
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const cloud = new CloudClient(serverUrl);
    const accMgr = new AccountManager(cloud, vault, idMgr, store, storage);

    await accMgr.registerAccount({
      username: 'recovery_test_user',
      password: 'CorrectPassword123!',
      spaceName: 'Main',
    });

    // Attempt restore with wrong password on clean device
    const cleanStorage = new MemoryAdapter();
    const cleanVault = new SpaceVaultManager();
    const cleanStore = new EncryptedSpaceStore(cleanStorage);
    const cleanIdMgr = new SpaceIdentityManager();
    const cleanCloud = new CloudClient(serverUrl);
    const cleanAccMgr = new AccountManager(cleanCloud, cleanVault, cleanIdMgr, cleanStore, cleanStorage);

    await expect(
      cleanAccMgr.restoreAccount({
        username: 'recovery_test_user',
        password: 'WrongPassword999!',
      })
    ).rejects.toThrow(/Invalid username or password/i);
  }, 60000);
});
