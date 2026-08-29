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
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToHex } from '../src/crypto/utils.ts';

describe('Phase 42: Account Recovery Forensic Lifecycle & Zero-Knowledge Verification Suite', () => {
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

  it('proves full local storage wipe -> account recovery -> identical Master Key and Ed25519 identityId', async () => {
    // 1. Setup Initial Account (Device 1)
    const client1 = new CloudClient(serverUrl);
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();
    const acctMgr1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

    const originalUsername = 'Alice_Phase42';
    const originalPassword = 'AliceSuperSecret123!';

    const { session: session1, identityDoc: idDoc1 } = await acctMgr1.registerAccount({
      username: originalUsername,
      password: originalPassword,
      spaceName: 'Alice Main Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const originalMasterKeyHex = bytesToHex(session1.getMasterKey());
    const originalIdentityId = idDoc1.identityId;

    expect(originalMasterKeyHex).toBeDefined();
    expect(originalIdentityId).toBeDefined();

    // 2. Simulate complete device wipe (Device 2 with fresh memory adapters and zero local state)
    const client2 = new CloudClient(serverUrl);
    const storage2 = new MemoryAdapter(); // Empty storage
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storage2);
    const idMgr2 = new SpaceIdentityManager();
    const acctMgr2 = new AccountManager(client2, vault2, idMgr2, store2, storage2);

    // 3. Perform Account Recovery on Device 2
    const { session: restoredSession, identityDoc: restoredIdDoc } = await acctMgr2.restoreAccount({
      username: 'alice_phase42', // Test case-insensitive normalization
      password: originalPassword,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const restoredMasterKeyHex = bytesToHex(restoredSession.getMasterKey());
    const restoredIdentityId = restoredIdDoc.identityId;

    // 4. Assert 100% Cryptographic Identity Continuity
    expect(restoredMasterKeyHex).toBe(originalMasterKeyHex);
    expect(restoredIdentityId).toBe(originalIdentityId);
    expect(restoredSession.spaceId).toBe(session1.spaceId);

    // 5. Verify Diagnostic Telemetry captured all recovery stages
    const recoveryEvents = RuntimeDiagnostics.getHistory('RECOVERY');
    expect(recoveryEvents.some((e) => e.tag === 'restoreInitiated')).toBe(true);
    expect(recoveryEvents.some((e) => e.tag === 'serverAuthSuccess')).toBe(true);
    expect(recoveryEvents.some((e) => e.tag === 'vaultDecryptionSuccess')).toBe(true);
    expect(recoveryEvents.some((e) => e.tag === 'spaceRestoredSuccess')).toBe(true);
  });

  it('rejects account recovery with wrong password and produces clear diagnostic telemetry', async () => {
    const client1 = new CloudClient(serverUrl);
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();
    const acctMgr1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

    await acctMgr1.registerAccount({
      username: 'bob_phase42',
      password: 'CorrectPassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const client2 = new CloudClient(serverUrl);
    const storage2 = new MemoryAdapter();
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storage2);
    const idMgr2 = new SpaceIdentityManager();
    const acctMgr2 = new AccountManager(client2, vault2, idMgr2, store2, storage2);

    await expect(
      acctMgr2.restoreAccount({
        username: 'bob_phase42',
        password: 'WRONG_PASSWORD_XYZ',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();

    const recoveryEvents = RuntimeDiagnostics.getHistory('RECOVERY');
    expect(recoveryEvents.some((e) => e.tag === 'serverAuthFailed')).toBe(true);
  });

  it('rejects account recovery for nonexistent username', async () => {
    const client = new CloudClient(serverUrl);
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const acctMgr = new AccountManager(client, vault, idMgr, store, storage);

    await expect(
      acctMgr.restoreAccount({
        username: 'nonexistent_user_9999',
        password: 'SomePassword123!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();
  });
});
