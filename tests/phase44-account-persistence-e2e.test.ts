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
import { bytesToHex } from '../src/crypto/utils.ts';

describe('Phase 44: End-to-End Remote Account Persistence & Reinstall Recovery Suite', () => {
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

  it('proves that uninstalling the app does NOT destroy the account and recovery reconstructs identical state from zero local storage', async () => {
    // =========================================================================
    // STEP 1: INITIAL REGISTRATION & DATA STORAGE (DEVICE A)
    // =========================================================================
    const clientA = new CloudClient(serverUrl);
    const storageA = new MemoryAdapter();
    await storageA.init();

    const vaultA = new SpaceVaultManager();
    const storeA = new EncryptedSpaceStore(storageA);
    const idMgrA = new SpaceIdentityManager();
    const acctMgrA = new AccountManager(clientA, vaultA, idMgrA, storeA, storageA);

    const { session: sessionA, identityDoc: docA, account: accountA } = await acctMgrA.registerAccount({
      username: 'Alice_Secure_44',
      password: 'AliceSuperSecretPassphrase123!',
      spaceName: 'Alice Primary Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const origMasterKeyHex = bytesToHex(sessionA.getMasterKey());
    const origIdentityId = docA.identityId;
    const origSpaceId = sessionA.spaceId;
    const origAccountId = accountA.accountId;

    // Verify account and recovery vault exist in remote database
    const remoteAccount = await cloudDb.getAccountByUsername('alice_secure_44');
    expect(remoteAccount).not.toBeNull();
    expect(remoteAccount?.accountId).toBe(origAccountId);

    const remoteVault = await cloudDb.getRecoveryState(origAccountId);
    expect(remoteVault).not.toBeNull();
    expect(remoteVault?.encryptedVaultBlob).toBeDefined();

    // =========================================================================
    // STEP 2: SIMULATE COMPLETE APP UNINSTALL (DESTROY ALL LOCAL STATE)
    // =========================================================================
    // storageA is abandoned; no references carried over
    expect((await storageA.listEnvelopes()).length).toBeGreaterThan(0); // device A had local state

    // =========================================================================
    // STEP 3: FRESH INSTALLATION ON DEVICE B (EMPTY STORAGE)
    // =========================================================================
    const clientB = new CloudClient(serverUrl);
    const storageB = new MemoryAdapter(); // 100% empty storage
    await storageB.init();
    expect((await storageB.listEnvelopes()).length).toBe(0);

    const vaultB = new SpaceVaultManager();
    const storeB = new EncryptedSpaceStore(storageB);
    const idMgrB = new SpaceIdentityManager();
    const acctMgrB = new AccountManager(clientB, vaultB, idMgrB, storeB, storageB);

    // =========================================================================
    // STEP 4: RECOVER ACCOUNT ON FRESH DEVICE
    // =========================================================================
    const { session: sessionB, identityDoc: docB, account: accountB } = await acctMgrB.restoreAccount({
      username: 'alice_secure_44',
      password: 'AliceSuperSecretPassphrase123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const restoredMasterKeyHex = bytesToHex(sessionB.getMasterKey());
    const restoredIdentityId = docB.identityId;
    const restoredSpaceId = sessionB.spaceId;
    const restoredAccountId = accountB.accountId;

    // =========================================================================
    // STEP 5: VERIFY CRYPTOGRAPHIC INVARIANTS & IDENTITY CONTINUITY
    // =========================================================================
    expect(restoredAccountId).toBe(origAccountId);
    expect(restoredIdentityId).toBe(origIdentityId);
    expect(restoredSpaceId).toBe(origSpaceId);
    expect(restoredMasterKeyHex).toBe(origMasterKeyHex);

    // Verify local Space envelope was recreated in storageB
    const envelopesB = vaultB.listEnvelopes();
    expect(envelopesB.length).toBeGreaterThanOrEqual(1);
    expect(envelopesB.some((e) => e.spaceId === origSpaceId)).toBe(true);

    // Verify Space can be locked and unlocked again with the same passphrase
    const unlockedAgain = vaultB.unlockSpace('AliceSuperSecretPassphrase123!', origSpaceId);
    expect(bytesToHex(unlockedAgain.getMasterKey())).toBe(origMasterKeyHex);
  });
});
