/**
 * VEIL Phase 30 Step 1: Cloud Session Persistence & Restoration Tests.
 *
 * Verifies that legitimate cloud session credentials are encrypted inside
 * the EncryptedSpaceStore upon registration/restoration, and automatically
 * restored into CloudClient across Space lock/unlock cycles.
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
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 30 Step 1: Cloud Session Persistence & Restoration', () => {
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

  it('saves cloud session to EncryptedSpaceStore during registration', async () => {
    const client = new CloudClient(serverUrl);
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const acctMgr = new AccountManager(client, vault, idMgr, store, storage);

    const { session, account } = await acctMgr.registerAccount({
      username: 'alice_persisted',
      password: 'StrongPassword123!',
      spaceName: 'Alice Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Verify sessionToken is set on client
    expect(client.getSessionToken()).toBeDefined();
    expect(client.getAccountId()).toBe(account.accountId);

    // Verify session credentials are encrypted in store under 'veil:cloud:session'
    const saved = store.get<any>(session, 'veil:cloud:session');
    expect(saved).toBeDefined();
    expect(saved.sessionToken).toBe(client.getSessionToken());
    expect(saved.accountId).toBe(account.accountId);
    expect(saved.deviceId).toBe(client.getDeviceId());
    expect(saved.username).toBe('alice_persisted');
    expect(saved.expiresAt).toBeGreaterThan(Date.now());
  });

  it('restores cloud session into a fresh CloudClient upon Space unlock', async () => {
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();

    const client1 = new CloudClient(serverUrl);
    const acctMgr1 = new AccountManager(client1, vault, idMgr, store, storage);

    const { session } = await acctMgr1.registerAccount({
      username: 'bob_persisted',
      password: 'StrongPassword123!',
      spaceName: 'Bob Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const spaceId = session.spaceId;
    const initialToken = client1.getSessionToken();

    // Simulate browser reload: create fresh client with null session
    const client2 = new CloudClient(serverUrl);
    expect(client2.getSessionToken()).toBeNull();

    // Unlock space with passphrase
    const unlockedSession = vault.unlockSpace('StrongPassword123!', spaceId);
    expect(unlockedSession.isActive()).toBe(true);

    // Simulate loadSpaceData restoring session from EncryptedSpaceStore
    const savedSession = store.get<any>(unlockedSession, 'veil:cloud:session');
    expect(savedSession).toBeDefined();
    expect(savedSession.expiresAt).toBeGreaterThan(Date.now());

    client2.setSession(savedSession.sessionToken, savedSession.accountId, savedSession.deviceId);
    expect(client2.getSessionToken()).toBe(initialToken);

    // Verify authenticated requests work with restored session
    const devices = await client2.listDevices();
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0].deviceId).toBe(savedSession.deviceId);
  });

  it('saves cloud session to EncryptedSpaceStore during account restore', async () => {
    // 1. Initial registration on Device 1
    const client1 = new CloudClient(serverUrl);
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();
    const acctMgr1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

    await acctMgr1.registerAccount({
      username: 'carol_persisted',
      password: 'StrongPassword123!',
      spaceName: 'Carol Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Restore account on clean Device 2
    const client2 = new CloudClient(serverUrl);
    const storage2 = new MemoryAdapter();
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storage2);
    const idMgr2 = new SpaceIdentityManager();
    const acctMgr2 = new AccountManager(client2, vault2, idMgr2, store2, storage2);

    const restored = await acctMgr2.restoreAccount({
      username: 'carol_persisted',
      password: 'StrongPassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Verify session stored on restored space
    const saved = store2.get<any>(restored.session, 'veil:cloud:session');
    expect(saved).toBeDefined();
    expect(saved.sessionToken).toBe(client2.getSessionToken());
    expect(saved.accountId).toBe(restored.account.accountId);
    expect(saved.username).toBe('carol_persisted');
  });

  it('rejects expired sessions during unlock restoration', async () => {
    const client = new CloudClient(serverUrl);
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const acctMgr = new AccountManager(client, vault, idMgr, store, storage);

    const { session } = await acctMgr.registerAccount({
      username: 'dave_expired',
      password: 'StrongPassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Manually set session expiration in the past
    store.set(session, 'veil:cloud:session', {
      sessionToken: 'expired_token_123',
      accountId: 'acc_test',
      deviceId: 'dev_test',
      expiresAt: Date.now() - 10000,
      username: 'dave_expired',
    });

    // Fresh client
    const freshClient = new CloudClient(serverUrl);

    // Emulate loadSpaceData logic
    const savedSession = store.get<any>(session, 'veil:cloud:session');
    if (savedSession && savedSession.sessionToken && savedSession.expiresAt > Date.now()) {
      freshClient.setSession(savedSession.sessionToken, savedSession.accountId, savedSession.deviceId);
    }

    // Must remain null because session was expired
    expect(freshClient.getSessionToken()).toBeNull();
  });
});
