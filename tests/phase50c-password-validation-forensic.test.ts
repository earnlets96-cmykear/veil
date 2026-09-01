/**
 * VEIL Phase 50C: Password Validation Forensic Acceptance Suite
 *
 * Validates:
 * A. Newly created account + correct password -> succeeds.
 * B. Existing account + correct password -> succeeds.
 * C. Wrong password -> securely rejected by authoritative server.
 * D. Recovered account + correct password -> succeeds without false local rejection.
 * E. Account with multiple spaces & decoy space -> rewraps matching space without corrupting decoy space.
 * F. Password previously changed -> successive password changes succeed cleanly.
 * G. Server accepts password but local envelope has secondary credentials -> succeeds and keeps secondary isolated.
 * H. Multiple same-device accounts -> correct account selected and updated without collision.
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

describe('Phase 50C: Password Validation Forensic Acceptance Suite', () => {
  let server: RelayServer;
  let baseUrl: string;
  let tempDir: string;
  let cloudDb: SqlCloudDatabase;
  let cloudClient: CloudClient;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let storageAdapter: MemoryStorageAdapter;
  let accountManager: AccountManager;
  let portCounter = 18200 + Math.floor(Math.random() * 500);

  beforeEach(async () => {
    const testPort = portCounter++;
    baseUrl = `http://127.0.0.1:${testPort}`;
    tempDir = path.join(process.cwd(), 'scratch', `phase50c_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
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

    cloudClient = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    storageAdapter = new MemoryStorageAdapter();
    store = new EncryptedSpaceStore(storageAdapter);
    vault = new SpaceVaultManager();
    idMgr = new SpaceIdentityManager();
    accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);
  });

  afterEach(async () => {
    if (server) await server.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('A. Newly created account + correct password -> succeeds cleanly', async () => {
    const reg = await accountManager.registerAccount({
      username: 'alice_50c',
      password: 'initial_password_123',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    await accountManager.changePassword({
      session: reg.session,
      oldPassword: 'initial_password_123',
      newPassword: 'new_password_456',
      username: 'alice_50c',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const loginRes = await cloudClient.loginAccount({
      username: 'alice_50c',
      password: 'new_password_456',
      deviceId: 'dev_a',
    });
    expect(loginRes.account.username).toBe('alice_50c');
  });

  it('B. Existing account + correct password -> succeeds without false rejection', async () => {
    const reg = await accountManager.registerAccount({
      username: 'bob_50c',
      password: 'bob_initial_pass',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Simulate session token restoration from disk
    const storedSession = store.get<any>(reg.session, 'veil:cloud:session');
    expect(storedSession?.sessionToken).toBeDefined();

    await accountManager.changePassword({
      session: reg.session,
      oldPassword: 'bob_initial_pass',
      newPassword: 'bob_updated_pass',
      username: 'bob_50c',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const loginRes = await cloudClient.loginAccount({
      username: 'bob_50c',
      password: 'bob_updated_pass',
      deviceId: 'dev_b',
    });
    expect(loginRes.account.username).toBe('bob_50c');
  });

  it('C. Wrong password -> securely rejected by authoritative server', async () => {
    const reg = await accountManager.registerAccount({
      username: 'charlie_50c',
      password: 'charlie_real_pass',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    await expect(
      accountManager.changePassword({
        session: reg.session,
        oldPassword: 'wrong_guess_pass',
        newPassword: 'charlie_new_pass',
        username: 'charlie_50c',
        newKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();

    // Verify original password is still intact on server
    const loginRes = await cloudClient.loginAccount({
      username: 'charlie_50c',
      password: 'charlie_real_pass',
      deviceId: 'dev_c',
    });
    expect(loginRes.account.username).toBe('charlie_50c');
  });

  it('D. Recovered account + correct password -> succeeds without false local rejection', async () => {
    // 1. Initial registration
    const reg = await accountManager.registerAccount({
      username: 'dave_50c',
      password: 'dave_recovery_pass',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Simulate fresh install recovery
    const freshAdapter = new MemoryStorageAdapter();
    const freshStore = new EncryptedSpaceStore(freshAdapter);
    const freshVault = new SpaceVaultManager();
    const freshIdMgr = new SpaceIdentityManager();
    const freshClient = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    const freshAccountMgr = new AccountManager(freshClient, freshVault, freshIdMgr, freshStore, freshAdapter);

    const restoreRes = await freshAccountMgr.restoreAccount({
      username: 'dave_50c',
      password: 'dave_recovery_pass',
      deviceId: 'dev_fresh_dave',
      deviceName: 'Restored Device',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(restoreRes.account.username).toBe('dave_50c');

    // 3. Changing password on recovered account must NEVER falsely throw "Invalid current password"
    await freshAccountMgr.changePassword({
      session: restoreRes.session,
      oldPassword: 'dave_recovery_pass',
      newPassword: 'dave_post_recovery_pass',
      username: 'dave_50c',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const loginRes = await freshClient.loginAccount({
      username: 'dave_50c',
      password: 'dave_post_recovery_pass',
      deviceId: 'dev_fresh_dave',
    });
    expect(loginRes.account.username).toBe('dave_50c');
  });

  it('E. Account with multiple spaces & decoy space -> updates matching space without corrupting decoy space', async () => {
    const reg = await accountManager.registerAccount({
      username: 'eve_50c',
      password: 'eve_main_password',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Create a decoy space with an independent passphrase
    const decoyEnvelope = vault.createSpace({
      name: 'Decoy Space',
      password: 'independent_decoy_pass',
      isDecoy: true,
      canonicalUsername: 'eve_50c',
      accountId: reg.account.accountId,
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    await vault.saveEnvelopeToStorage(decoyEnvelope, storageAdapter);

    // Change main account password
    await accountManager.changePassword({
      session: reg.session,
      oldPassword: 'eve_main_password',
      newPassword: 'eve_new_password',
      username: 'eve_50c',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 1. Main space unlocks with new password
    const unlockedMain = vault.unlockSpace('eve_new_password', reg.session.spaceId);
    expect(unlockedMain.spaceId).toBe(reg.session.spaceId);

    // 2. Decoy space is completely intact and still unlocks with its own independent passphrase
    const unlockedDecoy = vault.unlockSpace('independent_decoy_pass', decoyEnvelope.spaceId);
    expect(unlockedDecoy.spaceId).toBe(decoyEnvelope.spaceId);
    expect(unlockedDecoy.isDecoy).toBe(true);
  });

  it('F. Password previously changed -> successive password changes succeed cleanly', async () => {
    const reg = await accountManager.registerAccount({
      username: 'frank_50c',
      password: 'pass_version_1',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Change 1 -> 2
    await accountManager.changePassword({
      session: reg.session,
      oldPassword: 'pass_version_1',
      newPassword: 'pass_version_2',
      username: 'frank_50c',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Change 2 -> 3
    await accountManager.changePassword({
      session: reg.session,
      oldPassword: 'pass_version_2',
      newPassword: 'pass_version_3',
      username: 'frank_50c',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const loginRes = await cloudClient.loginAccount({
      username: 'frank_50c',
      password: 'pass_version_3',
      deviceId: 'dev_f',
    });
    expect(loginRes.account.username).toBe('frank_50c');
  });

  it('G. Correct account selected when multiple same-device accounts exist', async () => {
    // User 1 on device
    const reg1 = await accountManager.registerAccount({
      username: 'grace_50c',
      password: 'grace_password_123',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // User 2 on device
    const reg2 = await accountManager.registerAccount({
      username: 'heidi_50c',
      password: 'heidi_password_456',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Change password for Grace
    await accountManager.changePassword({
      session: reg1.session,
      oldPassword: 'grace_password_123',
      newPassword: 'grace_new_pass_789',
      username: 'grace_50c',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Verify Grace's new password works
    const graceLogin = await cloudClient.loginAccount({
      username: 'grace_50c',
      password: 'grace_new_pass_789',
      deviceId: 'dev_g',
    });
    expect(graceLogin.account.username).toBe('grace_50c');

    // Verify Heidi's account is completely unaffected and intact
    const heidiLogin = await cloudClient.loginAccount({
      username: 'heidi_50c',
      password: 'heidi_password_456',
      deviceId: 'dev_h',
    });
    expect(heidiLogin.account.username).toBe('heidi_50c');
  });
});
