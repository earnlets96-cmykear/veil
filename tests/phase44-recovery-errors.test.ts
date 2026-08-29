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

describe('Phase 44: Account Recovery Error Discrimination Suite', () => {
  let server: RelayServer;
  let serverUrl: string;
  let cloudDb: MemoryCloudDatabase;

  beforeEach(async () => {
    cloudDb = new MemoryCloudDatabase();
    const objectStorage = new LocalDiskObjectStorage();
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

  it('rejects wrong password with explicit authentication error', async () => {
    const client = new CloudClient(serverUrl);
    const storage = new MemoryAdapter();
    const acctMgr = new AccountManager(
      client,
      new SpaceVaultManager(),
      new SpaceIdentityManager(),
      new EncryptedSpaceStore(storage),
      storage
    );

    await acctMgr.registerAccount({
      username: 'bob_phase44',
      password: 'CorrectPassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const clientFresh = new CloudClient(serverUrl);
    const storageFresh = new MemoryAdapter();
    const acctMgrFresh = new AccountManager(
      clientFresh,
      new SpaceVaultManager(),
      new SpaceIdentityManager(),
      new EncryptedSpaceStore(storageFresh),
      storageFresh
    );

    await expect(
      acctMgrFresh.restoreAccount({
        username: 'bob_phase44',
        password: 'WrongPassword999!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow(/Invalid username or password/i);
  });

  it('reports distinct network failure error when server is unreachable', async () => {
    // Port 59998 has no running server
    const unreachableClient = new CloudClient('http://127.0.0.1:59998');
    const storage = new MemoryAdapter();
    const acctMgr = new AccountManager(
      unreachableClient,
      new SpaceVaultManager(),
      new SpaceIdentityManager(),
      new EncryptedSpaceStore(storage),
      storage
    );

    await expect(
      acctMgr.restoreAccount({
        username: 'bob_phase44',
        password: 'Password123!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow(/Unable to connect to recovery server/i);
  });

  it('reports distinct error when account has no recovery backup on cloud server', async () => {
    const client = new CloudClient(serverUrl);

    // Register raw account directly on server without recovery vault
    await client.registerAccount({
      username: 'charlie_no_vault',
      password: 'Password123!',
      deviceId: 'dev_charlie_01',
    });

    const storageFresh = new MemoryAdapter();
    const acctMgrFresh = new AccountManager(
      client,
      new SpaceVaultManager(),
      new SpaceIdentityManager(),
      new EncryptedSpaceStore(storageFresh),
      storageFresh
    );

    await expect(
      acctMgrFresh.restoreAccount({
        username: 'charlie_no_vault',
        password: 'Password123!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow(/Account has no encrypted identity backup on cloud server/i);
  });

  it('supports idempotent repeated recovery without corrupting state', async () => {
    const client = new CloudClient(serverUrl);
    const storage = new MemoryAdapter();
    const acctMgr = new AccountManager(
      client,
      new SpaceVaultManager(),
      new SpaceIdentityManager(),
      new EncryptedSpaceStore(storage),
      storage
    );

    await acctMgr.registerAccount({
      username: 'dave_repeat_44',
      password: 'DavePassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const storageFresh = new MemoryAdapter();
    const vaultFresh = new SpaceVaultManager();
    const acctMgrFresh = new AccountManager(
      client,
      vaultFresh,
      new SpaceIdentityManager(),
      new EncryptedSpaceStore(storageFresh),
      storageFresh
    );

    // First recovery
    const res1 = await acctMgrFresh.restoreAccount({
      username: 'dave_repeat_44',
      password: 'DavePassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Second recovery on the same device
    const res2 = await acctMgrFresh.restoreAccount({
      username: 'dave_repeat_44',
      password: 'DavePassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(res1.account.accountId).toBe(res2.account.accountId);
    expect(res1.identityDoc.identityId).toBe(res2.identityDoc.identityId);
    expect(res1.session.spaceId).toBe(res2.session.spaceId);
  });
});
