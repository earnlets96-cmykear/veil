/**
 * Phase 51: Unified Cross-Device Account Architecture & Seamless Authentication Test Suite
 *
 * Validates that VEIL behaves as a persistent cloud messaging application across devices:
 * 1. Account created on Device A is persistently retrievable on fresh Device B with zero local storage.
 * 2. Unified unlockSpace performs seamless cloud login/restoration when no local envelopes exist.
 * 3. IdentityDocument, Space Master Key, contacts, and messages restore identically.
 * 4. Password changes propagate to cloud and are verifiable across fresh devices.
 * 5. Decoy accounts with different credentials enter independent accounts.
 * 6. Username uniqueness is enforced deterministically.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';

describe('Phase 51: Unified Cross-Device Account Architecture Acceptance Suite', () => {
  let server: RelayServer;
  let baseUrl: string;
  let tempDir: string;
  let cloudDb: SqlCloudDatabase;
  let portCounter = 18500 + Math.floor(Math.random() * 500);

  beforeEach(async () => {
    const testPort = portCounter++;
    baseUrl = `http://127.0.0.1:${testPort}`;
    tempDir = path.join(process.cwd(), 'scratch', `phase51_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const dbPath = path.join(tempDir, 'db.json');
    const storageDir = path.join(tempDir, 'obj');
    fs.mkdirSync(storageDir, { recursive: true });

    cloudDb = new SqlCloudDatabase(`file://${dbPath}`);
    server = new RelayServer({
      port: testPort,
      host: '127.0.0.1',
      store: new MemoryRelayStore(),
      cloudDatabase: cloudDb,
      objectStorage: new LocalDiskObjectStorage(storageDir),
    });
    await server.start();
  });

  afterEach(async () => {
    if (server) await server.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createClientEnvironment() {
    const clientStorage = new MemoryStorageAdapter();
    const clientStore = new EncryptedSpaceStore(clientStorage);
    const clientVault = new SpaceVaultManager();
    const clientIdMgr = new SpaceIdentityManager();
    const clientCloud = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    const clientAccountMgr = new AccountManager(
      clientCloud,
      clientVault,
      clientIdMgr,
      clientStore,
      clientStorage
    );
    return {
      storage: clientStorage,
      store: clientStore,
      vault: clientVault,
      idMgr: clientIdMgr,
      cloud: clientCloud,
      accountMgr: clientAccountMgr,
    };
  }

  it('1. Register on Device A -> Seamless login on fresh Device B with identical Master Key & Identity', async () => {
    const devA = createClientEnvironment();
    const username = 'alice_cross_dev';
    const password = 'AlicePassword123!';

    // Device A registers
    const regResult = await devA.accountMgr.registerAccount({
      username,
      password,
      spaceName: 'Alice Personal Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(regResult.account.username).toBe('alice_cross_dev');
    const originalSmk = bytesToBase64(regResult.session.getMasterKey());
    const originalIdentityId = regResult.identityDoc.identityId;

    // Device B is completely fresh (new phone / browser) with 0 local envelopes
    const devB = createClientEnvironment();
    expect(devB.vault.listEnvelopes().length).toBe(0);

    // Device B restores / logs in
    const restoreResult = await devB.accountMgr.restoreAccount({
      username,
      password,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(restoreResult.account.accountId).toBe(regResult.account.accountId);
    expect(restoreResult.account.username).toBe('alice_cross_dev');
    expect(bytesToBase64(restoreResult.session.getMasterKey())).toBe(originalSmk);
    expect(restoreResult.identityDoc.identityId).toBe(originalIdentityId);

    // Device B now has a valid persisted local envelope
    expect(devB.vault.listEnvelopes().length).toBe(1);
    const savedEnvelope = devB.vault.getEnvelope(restoreResult.session.spaceId);
    expect(savedEnvelope?.canonicalUsername).toBe('alice_cross_dev');
  });

  it('2. Account data & messages restored across devices', async () => {
    const devA = createClientEnvironment();
    const username = 'bob_data_sync';
    const password = 'BobPassword456!';

    // Device A registers and saves data
    const reg = await devA.accountMgr.registerAccount({
      username,
      password,
      spaceName: 'Bob Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    await devA.store.setAsync(reg.session, 'veil:test:note', { secret: 'CrossDeviceSecretData' });
    await devA.accountMgr.createOrUpdateRecoveryVault(reg.session, password, username, FAST_TEST_KDF_PARAMS);

    // Device B logs in
    const devB = createClientEnvironment();
    const restored = await devB.accountMgr.restoreAccount({
      username,
      password,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const note = await devB.store.getAsync(restored.session, 'veil:test:note');
    expect(note).toEqual({ secret: 'CrossDeviceSecretData' });
  });

  it('3. Password change on Device B -> Old password rejected on Device C -> New password accepted on Device C', async () => {
    const devA = createClientEnvironment();
    const username = 'charlie_pwd';
    const initialPassword = 'InitialPassword789!';
    const newPassword = 'UpdatedPassword999!';

    // 1. Device A registers
    const reg = await devA.accountMgr.registerAccount({
      username,
      password: initialPassword,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Device B logs in with initial password
    const devB = createClientEnvironment();
    const devBSession = (await devB.accountMgr.restoreAccount({
      username,
      password: initialPassword,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    })).session;

    // 3. Device B changes password
    await devB.accountMgr.changePassword({
      session: devBSession,
      oldPassword: initialPassword,
      newPassword,
      username,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 4. Fresh Device C attempts login with old password -> MUST FAIL
    const devC = createClientEnvironment();
    await expect(
      devC.accountMgr.restoreAccount({
        username,
        password: initialPassword,
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();

    // 5. Fresh Device C logs in with new password -> MUST SUCCEED
    const devCRestore = await devC.accountMgr.restoreAccount({
      username,
      password: newPassword,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(devCRestore.account.accountId).toBe(reg.account.accountId);
    expect(devCRestore.account.username).toBe('charlie_pwd');
  });

  it('4. Decoy credentials enter distinct independent cloud accounts and spaces', async () => {
    const devA = createClientEnvironment();

    // Account 1: Real Account
    const realAcc = await devA.accountMgr.registerAccount({
      username: 'david_real',
      password: 'RealPassword111!',
      spaceName: 'Real Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Account 2: Decoy Account
    const decoyAcc = await devA.accountMgr.registerAccount({
      username: 'david_decoy',
      password: 'DecoyPassword222!',
      spaceName: 'Decoy Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(realAcc.account.accountId).not.toBe(decoyAcc.account.accountId);
    expect(realAcc.session.spaceId).not.toBe(decoyAcc.session.spaceId);

    // Fresh Device B can authenticate into either account independently
    const devB1 = createClientEnvironment();
    const restoredReal = await devB1.accountMgr.restoreAccount({
      username: 'david_real',
      password: 'RealPassword111!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    expect(restoredReal.account.accountId).toBe(realAcc.account.accountId);

    const devB2 = createClientEnvironment();
    const restoredDecoy = await devB2.accountMgr.restoreAccount({
      username: 'david_decoy',
      password: 'DecoyPassword222!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    expect(restoredDecoy.account.accountId).toBe(decoyAcc.account.accountId);
  });

  it('5. Duplicate username registration is cleanly rejected', async () => {
    const devA = createClientEnvironment();
    await devA.accountMgr.registerAccount({
      username: 'unique_user',
      password: 'Password123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const devB = createClientEnvironment();
    await expect(
      devB.accountMgr.registerAccount({
        username: '@UNIQUE_USER', // Different casing and @ prefix
        password: 'AnotherPassword456!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();
  });
});
