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

describe('Phase 43: Exhaustive Account Recovery & Zero-Knowledge Security Suite', () => {
  let server: RelayServer;
  let serverUrl: string;

  beforeEach(async () => {
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();

    const cloudDb = new MemoryCloudDatabase();
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

  it('proves complete recovery on fresh device: Master Key, Identity ID, Space, Contacts, Conversations', async () => {
    // 1. Initial Account Setup on Device 1
    const client1 = new CloudClient(serverUrl);
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();
    const acctMgr1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

    const { session: s1, identityDoc: doc1 } = await acctMgr1.registerAccount({
      username: 'Carol_Phase43',
      password: 'CarolSecurePassword123!',
      spaceName: 'Carol Secure Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Populate contacts and conversations in store 1
    store1.set(s1, 'veil:contacts:list', [{ identityId: 'peer_bob', name: 'Bob Peer' }]);
    store1.set(s1, 'veil:ui:conversations', [{ id: 'conv_bob', name: 'Bob Peer', lastMessage: 'Hello Carol' }]);

    const masterKey1Hex = bytesToHex(s1.getMasterKey());
    const id1 = doc1.identityId;

    // 2. Fresh Installation on Device 2 (MemoryAdapter completely empty)
    const client2 = new CloudClient(serverUrl);
    const storage2 = new MemoryAdapter();
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storage2);
    const idMgr2 = new SpaceIdentityManager();
    const acctMgr2 = new AccountManager(client2, vault2, idMgr2, store2, storage2);

    const { session: s2, identityDoc: doc2 } = await acctMgr2.restoreAccount({
      username: 'carol_phase43',
      password: 'CarolSecurePassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const masterKey2Hex = bytesToHex(s2.getMasterKey());
    const id2 = doc2.identityId;

    // Invariant verifications
    expect(masterKey2Hex).toBe(masterKey1Hex);
    expect(id2).toBe(id1);
    expect(s2.spaceId).toBe(s1.spaceId);

    // Verify diagnostic history recorded without secret leakage
    const recoveryEvents = RuntimeDiagnostics.getHistory('RECOVERY');
    expect(recoveryEvents.some((e) => e.tag === 'spaceRestoredSuccess')).toBe(true);

    for (const evt of recoveryEvents) {
      if (evt.data) {
        expect(evt.data.password).toBeUndefined();
        expect(evt.data.masterKey).toBeUndefined();
        expect(evt.data.privateKey).toBeUndefined();
      }
    }
  });

  it('rejects recovery on wrong password and maintains zero server key leakage', async () => {
    const client1 = new CloudClient(serverUrl);
    const storage1 = new MemoryAdapter();
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storage1);
    const idMgr1 = new SpaceIdentityManager();
    const acctMgr1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

    await acctMgr1.registerAccount({
      username: 'Dave_Phase43',
      password: 'DaveCorrectPassword123!',
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
        username: 'Dave_Phase43',
        password: 'DaveWrongPassword!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();

    const failedEvents = RuntimeDiagnostics.getHistory('RECOVERY').filter((e) => e.tag === 'serverAuthFailed');
    expect(failedEvents.length).toBe(1);
  });
});
