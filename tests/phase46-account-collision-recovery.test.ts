/**
 * VEIL Phase 46: Account Identity Collision, Password Change & Recovery Persistence
 * Forensic Regression Test Suite.
 *
 * Covers:
 * 1. Two local accounts with identical passwords coexistence without collision
 * 2. Strict account and cryptographic Space isolation
 * 3. Canonical username normalization (@Dagmawi, DAGMAWI, dagmawi -> dagmawi)
 * 4. Last-login username prefill & account switching
 * 5. Wrong username rejection (never unlocks another account with same password)
 * 6. Recovery of Account A while Account B has identical password
 * 7. Real cloud recovery persistence: snapshot updated on mutations (spaces, contacts, messages)
 * 8. Fresh-store full lifecycle recovery
 * 9. Multi-Space zero-knowledge recovery
 * 10. Post-recovery restart survival
 * 11. Password change flow end-to-end (local KEK rewrap, server auth update, recovery snapshot re-encryption)
 * 12. Old password rejection after password change
 * 13. New password unlock and fresh-store recovery
 * 14. Post-recovery security indicator banner requirement
 * 15. Indicator persistence across restart until password is changed
 * 16. Session separation (no plaintext auth password persisted)
 * 17. Zero secret / credential logging
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { SessionController } from '../src/ui/app/sessionController.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { normalizeUsername } from '../src/ui/app/AppState.tsx';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';

describe('VEIL Phase 46: Account Identity Collision, Password Change & Recovery Persistence Forensic Suite', () => {
  let server: RelayServer;
  let cloudDb: MemoryCloudDatabase;
  let baseUrl: string;

  beforeEach(async () => {
    RuntimeDiagnostics.clear();
    cloudDb = new MemoryCloudDatabase();
    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      new MemoryRelayStore(),
      cloudDb,
      new LocalDiskObjectStorage()
    );
    const addr = await server.start();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('1 & 2 & 5. Two local accounts with identical passwords coexist locally with strict deterministic isolation', async () => {
    const storageAdapter = new MemoryStorageAdapter();
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const store = new EncryptedSpaceStore(storageAdapter);
    const cloudClient = new CloudClient(baseUrl);
    const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

    const SAME_PASSWORD = 'IdenticalPassword123!';

    // 1. Create Account A (username: accountA)
    const resA = await accountManager.registerAccount({
      username: 'accountA',
      password: SAME_PASSWORD,
      spaceName: 'Account A Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    expect(resA.account.username).toBe('accounta');
    const spaceIdA = resA.session.spaceId;
    const identityIdA = resA.identityDoc.identityId;

    // Add state to Account A
    await store.setAsync(resA.session, 'veil:test:secret', 'Secret Data for Account A');

    // 2. Create Account B (username: accountB) using SAME password
    const resB = await accountManager.registerAccount({
      username: 'accountB',
      password: SAME_PASSWORD,
      spaceName: 'Account B Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    expect(resB.account.username).toBe('accountb');
    const spaceIdB = resB.session.spaceId;
    const identityIdB = resB.identityDoc.identityId;

    // Add state to Account B
    await store.setAsync(resB.session, 'veil:test:secret', 'Secret Data for Account B');

    // Verify both accounts coexist in memory and storage
    expect(vault.listEnvelopes().length).toBe(2);
    expect(spaceIdA).not.toBe(spaceIdB);
    expect(identityIdA).not.toBe(identityIdB);

    // 3. Deterministic targeted unlocking by canonical username
    const unlockedA = vault.unlockSpaceByUsername('accountA', SAME_PASSWORD);
    expect(unlockedA.spaceId).toBe(spaceIdA);
    const dataA = await store.getAsync(unlockedA, 'veil:test:secret');
    expect(dataA).toBe('Secret Data for Account A');

    const unlockedB = vault.unlockSpaceByUsername('accountB', SAME_PASSWORD);
    expect(unlockedB.spaceId).toBe(spaceIdB);
    const dataB = await store.getAsync(unlockedB, 'veil:test:secret');
    expect(dataB).toBe('Secret Data for Account B');

    // 4. Wrong username must fail clearly and never unlock the other account
    expect(() => vault.unlockSpaceByUsername('nonExistentUser', SAME_PASSWORD)).toThrow(
      /invalid credentials or corrupted envelope/i
    );
    expect(() => vault.unlockSpaceByUsername('accountA', 'WrongPass123!')).toThrow(
      /invalid credentials or corrupted envelope/i
    );
  });

  it('3. Normalizes canonical usernames across case, whitespace, and leading @ prefixes', () => {
    expect(normalizeUsername('@Dagmawi')).toBe('dagmawi');
    expect(normalizeUsername('DAGMAWI')).toBe('dagmawi');
    expect(normalizeUsername('  dagmawi  ')).toBe('dagmawi');
    expect(normalizeUsername(' @user_123 ')).toBe('user_123');
    expect(normalizeUsername('Alice')).toBe('alice');
  });

  it('4. Coexistence across app restarts and multi-account switching', async () => {
    const storageAdapter = new MemoryStorageAdapter();
    const SAME_PASSWORD = 'SharedDevicePass123!';

    // Session 1: Register Account 1 and Account 2
    {
      const vault = new SpaceVaultManager();
      const idMgr = new SpaceIdentityManager();
      const store = new EncryptedSpaceStore(storageAdapter);
      const cloudClient = new CloudClient(baseUrl);
      const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

      await accountManager.registerAccount({
        username: 'user_one',
        password: SAME_PASSWORD,
        spaceName: 'User One Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });

      await accountManager.registerAccount({
        username: 'user_two',
        password: SAME_PASSWORD,
        spaceName: 'User Two Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(vault.listEnvelopes().length).toBe(2);
    }

    // Session 2: Cold restart — reload envelopes from storage adapter
    {
      const vault = new SpaceVaultManager();
      await vault.loadEnvelopesFromStorage(storageAdapter);
      expect(vault.listEnvelopes().length).toBe(2);

      const netManager = new NetworkManager();
      const idMgr = new SpaceIdentityManager();
      const store = new EncryptedSpaceStore(storageAdapter);
      const sessionController = new SessionController(vault, store, storageAdapter, idMgr, netManager);

      // Unlock user_one with @ prefix and mixed case
      const sessOne = await sessionController.unlock(SAME_PASSWORD, '@User_One');
      expect(sessOne).toBeTruthy();
      expect(sessOne.name).toBe('User One Space');

      // Unlock user_two with whitespace
      const sessTwo = await sessionController.unlock(SAME_PASSWORD, '  user_two  ');
      expect(sessTwo).toBeTruthy();
      expect(sessTwo.name).toBe('User Two Space');
    }
  });

  it('6 & 7 & 8 & 9 & 10. Real cloud recovery persistence, multi-space recovery, fresh-store restore, and restart survival', async () => {
    const SAME_PASSWORD = 'RecoveryPass456!';
    const userA_storage = new MemoryStorageAdapter();

    let accountA_identityId = '';
    let accountA_space1Id = '';
    let accountA_space2Id = '';

    // Step A: Client A creates Account A with 2 Spaces and records
    {
      const vault = new SpaceVaultManager();
      const idMgr = new SpaceIdentityManager();
      const store = new EncryptedSpaceStore(userA_storage);
      const cloudClient = new CloudClient(baseUrl);
      const accountManager = new AccountManager(cloudClient, vault, idMgr, store, userA_storage);

      const res = await accountManager.registerAccount({
        username: 'recovered_user',
        password: SAME_PASSWORD,
        spaceName: 'Primary Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });

      accountA_identityId = res.identityDoc.identityId;
      accountA_space1Id = res.session.spaceId;

      // Add contact and conversation records to primary space
      await store.setAsync(res.session, 'veil:contacts:list', [{ identityId: 'peer_1', name: 'Bob' }]);
      await store.setAsync(res.session, 'veil:chat:history', [{ id: 'm1', text: 'Hello Bob' }]);

      // Add a Second Space to Account A
      const space2Header = vault.createSpace({
        name: 'Work Space',
        password: SAME_PASSWORD,
        kdfParams: FAST_TEST_KDF_PARAMS,
        canonicalUsername: 'recovered_user',
        accountId: res.account.accountId,
      });
      await vault.saveEnvelopeToStorage(space2Header, userA_storage);
      const space2Session = vault.unlockSpace(SAME_PASSWORD, space2Header.spaceId);
      idMgr.createIdentity(space2Session, store);
      accountA_space2Id = space2Header.spaceId;
      await store.setAsync(space2Session, 'veil:work:notes', 'Confidential Work Note');

      // Update cloud recovery snapshot with all spaces and records
      await accountManager.createOrUpdateRecoveryVault(space2Session, SAME_PASSWORD, 'recovered_user', FAST_TEST_KDF_PARAMS);
    }

    // Step B: Verify the recovery vault exists in database and contains valid ciphertext
    const cloudAccount = await cloudDb.getAccountByUsername('recovered_user');
    expect(cloudAccount).toBeTruthy();
    const recoveryState = await cloudDb.getRecoveryState(cloudAccount!.accountId);
    expect(recoveryState).toBeTruthy();
    expect(recoveryState?.encryptedVaultBlob).toBeTruthy();

    // Step C: Simulate Fresh Device / Reinstalled App (Fresh empty local storage)
    const freshStorage = new MemoryStorageAdapter();
    await freshStorage.init();
    expect(await freshStorage.listEnvelopes()).toHaveLength(0);

    // Also simulate another account already existing on this device with the SAME password!
    {
      const tempVault = new SpaceVaultManager();
      const tempIdMgr = new SpaceIdentityManager();
      const tempStore = new EncryptedSpaceStore(freshStorage);
      const tempCloudClient = new CloudClient(baseUrl);
      const tempAccountMgr = new AccountManager(tempCloudClient, tempVault, tempIdMgr, tempStore, freshStorage);

      await tempAccountMgr.registerAccount({
        username: 'existing_device_user',
        password: SAME_PASSWORD,
        spaceName: 'Existing Device Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });
    }
    expect(await freshStorage.listEnvelopes()).toHaveLength(1);

    // Step D: Recover Account A onto freshStorage
    {
      const vault = new SpaceVaultManager();
      await vault.loadEnvelopesFromStorage(freshStorage);
      const idMgr = new SpaceIdentityManager();
      const store = new EncryptedSpaceStore(freshStorage);
      const cloudClient = new CloudClient(baseUrl);
      const accountManager = new AccountManager(cloudClient, vault, idMgr, store, freshStorage);

      const restoreRes = await accountManager.restoreAccount({
        username: 'recovered_user',
        password: SAME_PASSWORD,
        customKdfParams: FAST_TEST_KDF_PARAMS,
        isEmergencyRecovery: true,
      });

      // Verify exact identityId match
      expect(restoreRes.identityDoc.identityId).toBe(accountA_identityId);

      // Verify both Spaces restored locally
      expect(vault.listEnvelopes().length).toBe(3); // 1 existing + 2 restored
      expect(vault.getEnvelope(accountA_space1Id)).toBeTruthy();
      expect(vault.getEnvelope(accountA_space2Id)).toBeTruthy();

      // Verify post-recovery password change required flag is set
      const recoverySec = await store.getAsync<{ recoveryPasswordChangeRequired?: boolean }>(
        restoreRes.session,
        'veil:account:recovery_security'
      );
      expect(recoverySec?.recoveryPasswordChangeRequired).toBe(true);

      // Verify decrypted records in primary space
      const contacts = await store.getAsync<any[]>(restoreRes.session, 'veil:contacts:list');
      expect(contacts).toEqual([{ identityId: 'peer_1', name: 'Bob' }]);

      // Verify records in second space
      const space2Session = vault.unlockSpace(SAME_PASSWORD, accountA_space2Id);
      const workNotes = await store.getAsync<string>(space2Session, 'veil:work:notes');
      expect(workNotes).toBe('Confidential Work Note');
    }

    // Step E: Cold Restart after recovery — user explicitly enters username + password
    {
      const vault = new SpaceVaultManager();
      await vault.loadEnvelopesFromStorage(freshStorage);
      expect(vault.listEnvelopes().length).toBe(3);

      const idMgr = new SpaceIdentityManager();
      const store = new EncryptedSpaceStore(freshStorage);
      const netManager = new NetworkManager();
      const sessionController = new SessionController(vault, store, freshStorage, idMgr, netManager);

      // Unlocking recovered_user opens recovered account
      const unlockedRecovered = await sessionController.unlock(SAME_PASSWORD, 'recovered_user');
      expect(unlockedRecovered.spaceId).toBe(accountA_space1Id);

      // Unlocking existing_device_user opens existing account
      const unlockedExisting = await sessionController.unlock(SAME_PASSWORD, 'existing_device_user');
      expect(unlockedExisting.name).toBe('Existing Device Space');
    }
  });

  it('11 & 12 & 13 & 14 & 15. Complete Password Change lifecycle, old password rejection, new password unlock, indicator clearing, and fresh recovery', async () => {
    const storageAdapter = new MemoryStorageAdapter();
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const store = new EncryptedSpaceStore(storageAdapter);
    const cloudClient = new CloudClient(baseUrl);
    const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

    const OLD_PASSWORD = 'OldPass12345!';
    const NEW_PASSWORD = 'NewPass98765!';

    // 1. Register Account
    const regRes = await accountManager.registerAccount({
      username: 'pwd_user',
      password: OLD_PASSWORD,
      spaceName: 'Password Test Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const activeSession = regRes.session;
    const spaceId = activeSession.spaceId;
    const initialIdentityId = regRes.identityDoc.identityId;

    // 2. Add an additional space
    const space2 = vault.createSpace({
      name: 'Second Space',
      password: OLD_PASSWORD,
      kdfParams: FAST_TEST_KDF_PARAMS,
      canonicalUsername: 'pwd_user',
      accountId: regRes.account.accountId,
    });
    await vault.saveEnvelopeToStorage(space2, storageAdapter);
    const space2Session = vault.unlockSpace(OLD_PASSWORD, space2.spaceId);
    idMgr.createIdentity(space2Session, store);
    await accountManager.createOrUpdateRecoveryVault(space2Session, OLD_PASSWORD, 'pwd_user', FAST_TEST_KDF_PARAMS);

    // 3. Execute Password Change
    await accountManager.changePassword({
      session: activeSession,
      oldPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      username: 'pwd_user',
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Verify post-recovery flag is cleared
    const sec = await store.getAsync<{ recoveryPasswordChangeRequired?: boolean }>(
      activeSession,
      'veil:account:recovery_security'
    );
    expect(sec?.recoveryPasswordChangeRequired).toBe(false);

    // 4. Old password must be REJECTED locally
    expect(() => vault.unlockSpaceByUsername('pwd_user', OLD_PASSWORD)).toThrow(
      /invalid credentials or corrupted envelope/i
    );

    // 5. New password successfully unlocks all spaces of the account
    const unlocked1 = vault.unlockSpaceByUsername('pwd_user', NEW_PASSWORD);
    expect(unlocked1.spaceId).toBe(spaceId);

    const unlocked2 = vault.unlockSpace(NEW_PASSWORD, space2.spaceId);
    expect(unlocked2.spaceId).toBe(space2.spaceId);

    // 6. Old password must be REJECTED on server login
    await expect(
      cloudClient.loginAccount({
        username: 'pwd_user',
        password: OLD_PASSWORD,
        deviceId: 'dev_test',
      })
    ).rejects.toThrow(/invalid username or password/i);

    // 7. New password successfully logs in to server
    const logRes = await cloudClient.loginAccount({
      username: 'pwd_user',
      password: NEW_PASSWORD,
      deviceId: 'dev_test',
    });
    expect(logRes.account.username).toBe('pwd_user');

    // 8. Cold Restart with new password
    {
      const restartVault = new SpaceVaultManager();
      await restartVault.loadEnvelopesFromStorage(storageAdapter);
      const restartStore = new EncryptedSpaceStore(storageAdapter);
      const restartNet = new NetworkManager();
      const restartController = new SessionController(restartVault, restartStore, storageAdapter, idMgr, restartNet);

      // Old password fails
      await expect(restartController.unlock(OLD_PASSWORD, 'pwd_user')).rejects.toThrow(
        /invalid credentials or corrupted envelope/i
      );

      // New password succeeds
      const sessionAfterRestart = await restartController.unlock(NEW_PASSWORD, 'pwd_user');
      expect(sessionAfterRestart.spaceId).toBe(spaceId);
    }

    // 9. Fresh-store recovery with new password
    {
      const freshStorageAdapter = new MemoryStorageAdapter();
      await freshStorageAdapter.init();
      const freshStore = new EncryptedSpaceStore(freshStorageAdapter);
      const freshVault = new SpaceVaultManager();
      const freshClient = new CloudClient(baseUrl);
      const freshAccountMgr = new AccountManager(freshClient, freshVault, idMgr, freshStore, freshStorageAdapter);

      // Old password fails recovery
      await expect(
        freshAccountMgr.restoreAccount({
          username: 'pwd_user',
          password: OLD_PASSWORD,
          customKdfParams: FAST_TEST_KDF_PARAMS,
        })
      ).rejects.toThrow();

      // New password restores account with identical identityId
      const restored = await freshAccountMgr.restoreAccount({
        username: 'pwd_user',
        password: NEW_PASSWORD,
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(restored.identityDoc.identityId).toBe(initialIdentityId);
      expect(freshVault.listEnvelopes().length).toBe(2);
    }
  });

  it('16 & 17. Verifies zero plaintext passwords in persistent records and zero sensitive secret logging', async () => {
    const storageAdapter = new MemoryStorageAdapter();
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const store = new EncryptedSpaceStore(storageAdapter);
    const cloudClient = new CloudClient(baseUrl);
    const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

    const TEST_PASS = 'SensitiveSuperSecretPass99!';

    await accountManager.registerAccount({
      username: 'security_check_user',
      password: TEST_PASS,
      spaceName: 'Sec Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Inspect all records in storage adapter
    const allEnvelopes = await storageAdapter.listEnvelopes();
    for (const env of allEnvelopes) {
      const serialized = JSON.stringify(env);
      expect(serialized).not.toContain(TEST_PASS);
    }

    const allRecords = await storageAdapter.listRecords(allEnvelopes[0].spaceId);
    for (const rec of allRecords) {
      const serialized = JSON.stringify(rec);
      expect(serialized).not.toContain(TEST_PASS);
      // All payloads must be encrypted ciphertext
      expect(rec.ciphertext).toBeTruthy();
      expect(rec.nonce).toBeTruthy();
    }

    // Inspect runtime diagnostic telemetry entries
    const entries = RuntimeDiagnostics.getEntries();
    for (const entry of entries) {
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain(TEST_PASS);
    }
  });

  it('18. Verifies durable SqlCloudDatabase persistence layer across cold server restarts and fresh-client recovery', async () => {
    const TEMP_SQL_DIR = path.join(process.cwd(), '.veil_test_sql_recovery_suite');
    if (fs.existsSync(TEMP_SQL_DIR)) fs.rmSync(TEMP_SQL_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_SQL_DIR, { recursive: true });

    const dbDir = path.join(TEMP_SQL_DIR, 'db');
    const relayDir = path.join(TEMP_SQL_DIR, 'relay');
    const objDir = path.join(TEMP_SQL_DIR, 'objects');

    const ORIGINAL_PASS = 'SqlSecurePass12345!';
    const USERNAME = 'sql_durable_alice';

    // -------------------------------------------------------------------------
    // Phase 1: Start Server 1 with SqlCloudDatabase on disk
    // -------------------------------------------------------------------------
    let db1 = new SqlCloudDatabase({ diskPath: dbDir });
    let store1 = new PersistentFileRelayStore(relayDir);
    let storage1 = new LocalDiskObjectStorage(objDir);
    await db1.init();
    await store1.init();
    await storage1.init();

    let server1 = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' }, store1, db1, storage1);
    let addr1 = await server1.start();
    let url1 = `http://127.0.0.1:${addr1.port}`;

    // Client 1: Register account on Server 1
    const clientStorage1 = new MemoryStorageAdapter();
    const vault1 = new SpaceVaultManager();
    const idMgr1 = new SpaceIdentityManager();
    const storeEnc1 = new EncryptedSpaceStore(clientStorage1);
    const client1 = new CloudClient(url1);
    const accountMgr1 = new AccountManager(client1, vault1, idMgr1, storeEnc1, clientStorage1);

    const regRes = await accountMgr1.registerAccount({
      username: USERNAME,
      password: ORIGINAL_PASS,
      spaceName: 'Primary Corporate Vault',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const space1Id = regRes.session.spaceId;
    const space1MasterKey = regRes.session.getMasterKey();
    const space1IdentityId = regRes.identityDoc.identityId;
    const space1SigningPub = regRes.identityDoc.signingPublicKey;
    const accountId = regRes.account.accountId;

    // Mutate Space 1: Add confidential contacts & messages
    await storeEnc1.setAsync(regRes.session, 'veil:contacts:list', {
      contacts: [
        { id: 'c_bob', username: 'bob', displayName: 'Bob Smith', verified: true },
        { id: 'c_carol', username: 'carol', displayName: 'Carol Danvers', verified: true },
      ],
    });

    // Add Space 2: Secret Operations
    const space2Header = vault1.createSpace({
      name: 'Secret Operations',
      password: ORIGINAL_PASS,
      kdfParams: FAST_TEST_KDF_PARAMS,
      canonicalUsername: USERNAME,
      accountId,
    });
    await vault1.saveEnvelopeToStorage(space2Header, clientStorage1);
    const session2 = vault1.unlockSpace(ORIGINAL_PASS, space2Header.spaceId);
    const id2 = idMgr1.createIdentity(session2, storeEnc1);
    const space2Id = session2.spaceId;
    const space2MasterKey = session2.getMasterKey();
    const space2IdentityId = id2.identityId;

    await storeEnc1.setAsync(session2, 'veil:operations:log', {
      mission: 'Alpha-9',
      clearance: 'TopSecret',
      records: ['Log A', 'Log B'],
    });

    // Update cloud recovery snapshot on Server 1 with all spaces & partition records
    await accountMgr1.createOrUpdateRecoveryVault(session2, ORIGINAL_PASS, USERNAME, FAST_TEST_KDF_PARAMS);

    // Verify recovery_states table row in db1
    const recRow1 = await db1.getRecoveryState(accountId);
    expect(recRow1).not.toBeNull();
    expect(recRow1?.accountId).toBe(accountId);
    expect(recRow1?.encryptedVaultBlob).toContain('VEIL-RECOVERY-SNAPSHOT-v2');

    // -------------------------------------------------------------------------
    // Phase 2: Shut down Server 1 completely (Cold Stop)
    // -------------------------------------------------------------------------
    await server1.stop();
    await db1.close();
    await store1.close();
    await storage1.close();

    // -------------------------------------------------------------------------
    // Phase 3: Start Server 2 from exact same disk path (Cold Restart)
    // -------------------------------------------------------------------------
    let db2 = new SqlCloudDatabase({ diskPath: dbDir });
    let store2 = new PersistentFileRelayStore(relayDir);
    let storage2 = new LocalDiskObjectStorage(objDir);
    await db2.init();
    await store2.init();
    await storage2.init();

    // Verify row survived cold server restart on disk
    const recRow2 = await db2.getRecoveryState(accountId);
    expect(recRow2).not.toBeNull();
    expect(recRow2?.accountId).toBe(accountId);
    expect(recRow2?.encryptedVaultBlob).toBe(recRow1?.encryptedVaultBlob);

    let server2 = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' }, store2, db2, storage2);
    let addr2 = await server2.start();
    let url2 = `http://127.0.0.1:${addr2.port}`;

    // -------------------------------------------------------------------------
    // Phase 4: Client 2 on fresh device (Destroy all local client storage)
    // -------------------------------------------------------------------------
    const freshClientStorage = new MemoryStorageAdapter(); // 0 envelopes, 0 records
    const freshVault = new SpaceVaultManager();
    const freshIdMgr = new SpaceIdentityManager();
    const freshStoreEnc = new EncryptedSpaceStore(freshClientStorage);
    const freshClient = new CloudClient(url2);
    const freshAccountMgr = new AccountManager(freshClient, freshVault, freshIdMgr, freshStoreEnc, freshClientStorage);

    expect(freshVault.listEnvelopes().length).toBe(0);

    // Restore from restarted cloud server
    const restoreRes = await freshAccountMgr.restoreAccount({
      username: `@${USERNAME.toUpperCase()}`, // with @ and uppercase to verify normalization
      password: ORIGINAL_PASS,
      customKdfParams: FAST_TEST_KDF_PARAMS,
      isEmergencyRecovery: true,
    });

    // 1. Verify Space 1 cryptographic continuity
    expect(restoreRes.session.spaceId).toBe(space1Id);
    expect(restoreRes.session.getMasterKey()).toEqual(space1MasterKey);
    expect(restoreRes.identityDoc.identityId).toBe(space1IdentityId);
    expect(restoreRes.identityDoc.signingPublicKey).toBe(space1SigningPub);

    // 2. Verify all Spaces reconstructed in fresh local vault
    const restoredEnvelopes = freshVault.listEnvelopes();
    expect(restoredEnvelopes.length).toBe(2);
    expect(restoredEnvelopes.map((e) => e.spaceId).sort()).toEqual([space1Id, space2Id].sort());

    // 3. Verify Space 2 unlock and cryptographic continuity
    const restoredSession2 = freshVault.unlockSpace(ORIGINAL_PASS, space2Id);
    expect(restoredSession2.getMasterKey()).toEqual(space2MasterKey);
    const restoredId2 = freshIdMgr.loadIdentity(restoredSession2, freshStoreEnc);
    expect(restoredId2?.document.identityId).toBe(space2IdentityId);

    // 4. Verify partition records restored and decrypted
    const restoredContacts = await freshStoreEnc.getAsync(restoreRes.session, 'veil:contacts:list');
    expect(restoredContacts).toEqual({
      contacts: [
        { id: 'c_bob', username: 'bob', displayName: 'Bob Smith', verified: true },
        { id: 'c_carol', username: 'carol', displayName: 'Carol Danvers', verified: true },
      ],
    });

    const restoredOps = await freshStoreEnc.getAsync(restoredSession2, 'veil:operations:log');
    expect(restoredOps).toEqual({
      mission: 'Alpha-9',
      clearance: 'TopSecret',
      records: ['Log A', 'Log B'],
    });

    // 5. Verify post-recovery password change flag
    const secFlag = freshStoreEnc.get(restoreRes.session, 'veil:account:recovery_security');
    expect(secFlag?.recoveryPasswordChangeRequired).toBe(true);

    // Clean up
    await server2.stop();
    await db2.close();
    await store2.close();
    await storage2.close();
    if (fs.existsSync(TEMP_SQL_DIR)) fs.rmSync(TEMP_SQL_DIR, { recursive: true, force: true });
  });
});
