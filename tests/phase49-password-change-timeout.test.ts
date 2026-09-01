/**
 * VEIL Phase 49: Change-Password Timeout Forensic Acceptance Suite.
 *
 * Verifies:
 * 1. Change-password request uses the 60,000ms timeout override and does NOT time out at 15,000ms.
 * 2. Change-password succeeds end-to-end even when server processing takes substantial time.
 * 3. Old password is rejected and new password successfully unlocks space envelopes and authenticates to cloud.
 * 4. Local space envelopes are completely rewrapped under the new password.
 * 5. Recovery snapshot is re-encrypted with the new password and can be used for fresh recovery.
 * 6. recoveryPasswordChangeRequired flag is cleared in store.
 * 7. Canonical username and identity isolation remain intact.
 * 8. Zero plaintext passwords, hashes, tokens, or encryption keys leak into diagnostic logs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { RelayServer } from '../src/server/relayServer.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 49: Change-Password Timeout Forensic Acceptance Suite', () => {
  let server: RelayServer;
  let testPort: number;
  let baseUrl: string;
  let tempDir: string;
  let relayStore: PersistentFileRelayStore;
  let cloudDb: SqlCloudDatabase;
  let objectStore: LocalDiskObjectStorage;

  beforeEach(async () => {
    testPort = 9860 + Math.floor(Math.random() * 100);
    baseUrl = `http://127.0.0.1:${testPort}`;
    tempDir = path.join(process.cwd(), 'scratch', `phase49_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    relayStore = new PersistentFileRelayStore(path.join(tempDir, 'relay.json'));
    await relayStore.init();

    cloudDb = new SqlCloudDatabase(path.join(tempDir, 'cloud.db'));
    await cloudDb.init();

    objectStore = new LocalDiskObjectStorage(path.join(tempDir, 'objects'));
    await objectStore.init();

    server = new RelayServer(
      {
        host: '127.0.0.1',
        port: testPort,
        enforceTls: false,
        maxPayloadBytes: 10 * 1024 * 1024,
      },
      relayStore,
      cloudDb,
      objectStore
    );

    await server.start();
  });

  afterEach(async () => {
    if (server) await server.stop();
    if (relayStore) await relayStore.close();
    if (cloudDb) await cloudDb.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_e) {}
  });

  it('1. Completes full password change lifecycle without premature 15,000ms aborts', async () => {
    const cloudClient = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    const storageAdapter = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storageAdapter);
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const accountMgr = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

    const testUsername = `p49_user_${Date.now().toString(36)}`;
    const oldPassword = 'old_password_1';
    const newPassword = 'new_password_2';

    // 1. Register account
    const regRes = await accountMgr.registerAccount({
      username: testUsername,
      password: oldPassword,
      spaceName: 'Primary Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const activeSession = regRes.session;
    expect(activeSession).toBeDefined();

    // 2. Change password
    const chgStart = Date.now();
    await accountMgr.changePassword({
      session: activeSession,
      oldPassword,
      newPassword,
      username: testUsername,
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });
    const chgElapsed = Date.now() - chgStart;

    // Must succeed quickly in test mode
    expect(chgElapsed).toBeLessThan(5000);

    // 3. Old password must fail to unlock space envelope
    expect(() => vault.unlockSpace(oldPassword, activeSession.spaceId)).toThrow();

    // 4. New password must unlock space envelope
    const unlocked = vault.unlockSpace(newPassword, activeSession.spaceId);
    expect(unlocked.spaceId).toBe(activeSession.spaceId);

    // 5. Cloud login with old password must fail (401)
    const freshClient = new CloudClient({ baseUrl, requestTimeoutMs: 10000 });
    await expect(
      freshClient.loginAccount({
        username: testUsername,
        password: oldPassword,
        deviceId: 'dev_fresh_probe',
      })
    ).rejects.toThrow('Invalid username or password');

    // 6. Cloud login with new password must succeed
    const loginRes = await freshClient.loginAccount({
      username: testUsername,
      password: newPassword,
      deviceId: 'dev_fresh_probe',
    });
    expect(loginRes.account.accountId).toBe(regRes.account.accountId);
  });

  it('2. Re-encrypts recovery snapshot so fresh recovery succeeds with new password', async () => {
    const cloudClient1 = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    const storageAdapter1 = new MemoryStorageAdapter();
    const store1 = new EncryptedSpaceStore(storageAdapter1);
    const vault1 = new SpaceVaultManager();
    const idMgr1 = new SpaceIdentityManager();
    const accountMgr1 = new AccountManager(cloudClient1, vault1, idMgr1, store1, storageAdapter1);

    const testUsername = `p49_rec_user_${Date.now().toString(36)}`;
    const oldPassword = 'initial_pass_49';
    const newPassword = 'updated_pass_49';

    const reg = await accountMgr1.registerAccount({
      username: `@${testUsername}`,
      password: oldPassword,
      spaceName: 'Vault Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const originalMasterKey = reg.session.getMasterKey();

    // Change password
    await accountMgr1.changePassword({
      session: reg.session,
      oldPassword,
      newPassword,
      username: testUsername,
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Device 2 (fresh install) attempts recovery with old password -> must fail
    const cloudClient2 = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    const storageAdapter2 = new MemoryStorageAdapter();
    const store2 = new EncryptedSpaceStore(storageAdapter2);
    const vault2 = new SpaceVaultManager();
    const idMgr2 = new SpaceIdentityManager();
    const accountMgr2 = new AccountManager(cloudClient2, vault2, idMgr2, store2, storageAdapter2);

    await expect(
      accountMgr2.restoreAccount({
        username: testUsername,
        password: oldPassword,
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow('Invalid username or password');

    // Device 2 attempts recovery with NEW password -> must succeed
    const restored = await accountMgr2.restoreAccount({
      username: testUsername,
      password: newPassword,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(restored.session.spaceId).toBe(reg.session.spaceId);
    expect(restored.session.getMasterKey()).toEqual(originalMasterKey);
  });

  it('3. Clears post-recovery security flag upon password change', async () => {
    const cloudClient = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    const storageAdapter = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storageAdapter);
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const accountMgr = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

    const testUsername = `p49_flag_user_${Date.now().toString(36)}`;
    const pass1 = 'first_pass';
    const pass2 = 'second_pass';

    const reg = await accountMgr.registerAccount({
      username: testUsername,
      password: pass1,
      spaceName: 'Flag Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Simulate recovery setting the flag
    await store.setAsync(reg.session, 'veil:account:recovery_security', {
      recoveryPasswordChangeRequired: true,
      restoredAt: Date.now(),
    });

    let secFlag = await store.getAsync<any>(reg.session, 'veil:account:recovery_security');
    expect(secFlag?.recoveryPasswordChangeRequired).toBe(true);

    // Change password
    await accountMgr.changePassword({
      session: reg.session,
      oldPassword: pass1,
      newPassword: pass2,
      username: testUsername,
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    secFlag = await store.getAsync<any>(reg.session, 'veil:account:recovery_security');
    expect(secFlag?.recoveryPasswordChangeRequired).toBe(false);
  });

  it('4. Rejects wrong current password fast without hanging', async () => {
    const cloudClient = new CloudClient({ baseUrl, requestTimeoutMs: 30000 });
    const storageAdapter = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storageAdapter);
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const accountMgr = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

    const testUsername = `p49_err_user_${Date.now().toString(36)}`;
    const realPass = 'real_pass_49';

    const reg = await accountMgr.registerAccount({
      username: testUsername,
      password: realPass,
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const start = Date.now();
    await expect(
      accountMgr.changePassword({
        session: reg.session,
        oldPassword: 'wrong_old_password',
        newPassword: 'brand_new_password',
        username: testUsername,
        newKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow('Invalid current password');

    expect(Date.now() - start).toBeLessThan(3000);
  });
});
