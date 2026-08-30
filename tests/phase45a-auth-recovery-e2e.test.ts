import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToHex } from '../src/crypto/utils.ts';

describe('Phase 45A: encrypted remote recovery snapshot', () => {
  let server: RelayServer;
  let url: string;

  beforeEach(async () => {
    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      new MemoryRelayStore(), new MemoryCloudDatabase(), new LocalDiskObjectStorage()
    );
    const address = await server.start();
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => { await server.stop(); });

  it('reconstructs identity, encrypted contacts and conversations from a remote v2 snapshot on a fresh store', async () => {
    const storageA = new MemoryAdapter(); await storageA.init();
    const vaultA = new SpaceVaultManager();
    const storeA = new EncryptedSpaceStore(storageA);
    const idsA = new SpaceIdentityManager();
    const managerA = new AccountManager(new CloudClient(url), vaultA, idsA, storeA, storageA);
    const created = await managerA.registerAccount({
      username: 'Recovery_Alice', password: 'RecoveryPass123!', spaceName: 'Alice', kdfParams: FAST_TEST_KDF_PARAMS,
    });
    await storeA.setAsync(created.session, 'veil:contacts:list', [{ identityId: 'peer-id', name: 'Peer' }]);
    await storeA.setAsync(created.session, 'veil:ui:conversations', [{ id: 'peer-id', lastMessage: 'encrypted' }]);
    await managerA.createOrUpdateRecoveryVault(created.session, 'RecoveryPass123!', 'recovery_alice', FAST_TEST_KDF_PARAMS);

    const originalIdentity = created.identityDoc.identityId;
    const originalMasterKey = bytesToHex(created.session.getMasterKey());
    const storageB = new MemoryAdapter(); await storageB.init();
    const vaultB = new SpaceVaultManager();
    const storeB = new EncryptedSpaceStore(storageB);
    const managerB = new AccountManager(new CloudClient(url), vaultB, new SpaceIdentityManager(), storeB, storageB);
    const restored = await managerB.restoreAccount({ username: '@RECOVERY_ALICE', password: 'RecoveryPass123!', customKdfParams: FAST_TEST_KDF_PARAMS });

    expect(restored.identityDoc.identityId).toBe(originalIdentity);
    expect(bytesToHex(restored.session.getMasterKey())).toBe(originalMasterKey);
    expect(await storeB.getAsync(restored.session, 'veil:contacts:list')).toEqual([{ identityId: 'peer-id', name: 'Peer' }]);
    expect(await storeB.getAsync(restored.session, 'veil:ui:conversations')).toEqual([{ id: 'peer-id', lastMessage: 'encrypted' }]);
    expect((await storeB.getAsync<any>(restored.session, 'veil:cloud:session')).authPassword).toBeUndefined();
  });
});
