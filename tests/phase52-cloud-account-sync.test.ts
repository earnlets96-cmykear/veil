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

describe('Phase 52: Definitive Cloud Account, Cross-Device Sync & Chat Persistence Acceptance Suite', { timeout: 60000 }, () => {
  let server: RelayServer;
  let baseUrl: string;
  let tempDir: string;
  let cloudDb: SqlCloudDatabase;
  let portCounter = 19500 + Math.floor(Math.random() * 500);

  beforeEach(async () => {
    const testPort = portCounter++;
    baseUrl = `http://127.0.0.1:${testPort}`;
    tempDir = path.join(process.cwd(), 'scratch', `phase52_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
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

  function createDevice(name = 'Device') {
    const storage = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storage);
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const client = new CloudClient({ baseUrl, requestTimeoutMs: 60000 });
    const accountManager = new AccountManager(client, vault, idMgr, store, storage);
    return { storage, store, vault, idMgr, client, accountManager, name };
  }

  it('Scenario 1: Cross-Device Chat & Message Persistence (Device A -> Fresh Device B)', async () => {
    const devA = createDevice('Device A (Android)');
    const username = 'alice_phase52';
    const password = 'AlicePassword123!';

    // 1. Device A registers account
    const regResult = await devA.accountManager.registerAccount({
      username,
      password,
      spaceName: 'Personal Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const spaceId = regResult.session.spaceId;
    const accountId = regResult.account.accountId;

    // 2. Device A populates profile, contacts, conversations, and messages
    const conv1Id = 'conv_alice_bob';
    const conv2Id = 'conv_alice_charlie';

    const conversations = [
      { id: conv1Id, type: 'direct', name: 'Alice & Bob', lastMessage: 'Message C', timestamp: 1000 },
      { id: conv2Id, type: 'direct', name: 'Alice & Charlie', lastMessage: 'Message E', timestamp: 2000 },
    ];

    const messages = {
      [conv1Id]: [
        { id: 'm1', conversationId: conv1Id, text: 'Message A', senderId: spaceId, isOutgoing: true, timestamp: 100 },
        { id: 'm2', conversationId: conv1Id, text: 'Message B', senderId: 'peer_bob', isOutgoing: false, timestamp: 200 },
        { id: 'm3', conversationId: conv1Id, text: 'Message C', senderId: spaceId, isOutgoing: true, timestamp: 300 },
      ],
      [conv2Id]: [
        { id: 'm4', conversationId: conv2Id, text: 'Message D', senderId: spaceId, isOutgoing: true, timestamp: 400 },
        { id: 'm5', conversationId: conv2Id, text: 'Message E', senderId: 'peer_charlie', isOutgoing: false, timestamp: 500 },
      ],
    };

    const contacts = [
      { identityId: 'peer_bob', name: 'Bob', verified: true },
      { identityId: 'peer_charlie', name: 'Charlie', verified: false },
    ];

    await devA.store.setAsync(regResult.session, 'veil:ui:conversations', conversations);
    await devA.store.setAsync(regResult.session, 'veil:ui:messages', messages);
    await devA.store.setAsync(regResult.session, 'veil:contacts:list', contacts);

    // Save cloud snapshot
    await devA.accountManager.createOrUpdateRecoveryVault(regResult.session, password, username, FAST_TEST_KDF_PARAMS);

    // 3. Device B: Completely Fresh Client (0 envelopes, 0 local state)
    const devB = createDevice('Device B (PC Web)');
    expect(devB.vault.listEnvelopes().length).toBe(0);

    const restoreResult = await devB.accountManager.restoreAccount({
      username,
      password,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Verify identity & account identifiers match
    expect(restoreResult.account.accountId).toBe(accountId);
    expect(restoreResult.session.spaceId).toBe(spaceId);

    // 4. Verify all conversations and messages are restored into Device B's local state
    const restoredConvs = await devB.store.getAsync<any[]>(restoreResult.session, 'veil:ui:conversations');
    const restoredMsgs = await devB.store.getAsync<Record<string, any[]>>(restoreResult.session, 'veil:ui:messages');
    const restoredContacts = await devB.store.getAsync<any[]>(restoreResult.session, 'veil:contacts:list');

    expect(restoredConvs).toBeDefined();
    expect(restoredConvs!.length).toBe(2);
    expect(restoredConvs![0].name).toBe('Alice & Bob');
    expect(restoredConvs![1].name).toBe('Alice & Charlie');

    expect(restoredMsgs).toBeDefined();
    expect(restoredMsgs![conv1Id].length).toBe(3);
    expect(restoredMsgs![conv1Id].map((m) => m.text)).toEqual(['Message A', 'Message B', 'Message C']);

    expect(restoredMsgs![conv2Id].length).toBe(2);
    expect(restoredMsgs![conv2Id].map((m) => m.text)).toEqual(['Message D', 'Message E']);

    expect(restoredContacts).toBeDefined();
    expect(restoredContacts!.length).toBe(2);

    // 5. Verify normal login does NOT require password change
    const recoverySec = await devB.store.getAsync<{ recoveryPasswordChangeRequired?: boolean }>(
      restoreResult.session,
      'veil:account:recovery_security'
    );
    expect(recoverySec?.recoveryPasswordChangeRequired).toBe(false);
  });

  it('Scenario 2: Bidirectional Chat Synchronization (Device B -> Device A)', async () => {
    const devA = createDevice('Device A');
    const devB = createDevice('Device B');
    const username = 'sync_bidirectional';
    const password = 'SyncPassword123!';

    // Device A registers and adds initial conversation
    const reg = await devA.accountManager.registerAccount({
      username,
      password,
      spaceName: 'Main',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    const convId = 'conv_shared';
    const initialMsgs = {
      [convId]: [{ id: 'm1', conversationId: convId, text: 'Hello from Device A', timestamp: 100 }],
    };
    await devA.store.setAsync(reg.session, 'veil:ui:messages', initialMsgs);
    await devA.accountManager.createOrUpdateRecoveryVault(reg.session, password, username, FAST_TEST_KDF_PARAMS);

    // Device B logs in
    const restored = await devB.accountManager.restoreAccount({
      username,
      password,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Device B sends a new message
    const currentMsgs = (await devB.store.getAsync<Record<string, any[]>>(restored.session, 'veil:ui:messages')) || {};
    const updatedMsgs = {
      ...currentMsgs,
      [convId]: [
        ...(currentMsgs[convId] || []),
        { id: 'm2', conversationId: convId, text: 'Hello from Device B', timestamp: 200 },
      ],
    };
    await devB.store.setAsync(restored.session, 'veil:ui:messages', updatedMsgs);
    await devB.accountManager.createOrUpdateRecoveryVault(restored.session, password, username, FAST_TEST_KDF_PARAMS);

    // Device A downloads latest cloud recovery state
    const devARestore = await devA.accountManager.restoreAccount({
      username,
      password,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const syncedMsgsOnA = await devA.store.getAsync<Record<string, any[]>>(devARestore.session, 'veil:ui:messages');
    expect(syncedMsgsOnA![convId].length).toBe(2);
    expect(syncedMsgsOnA![convId][1].text).toBe('Hello from Device B');
  });

  it('Scenario 3: Password Change Preserves All Chats, Contacts, and Identity', async () => {
    const dev = createDevice('Device');
    const username = 'pwd_change_test';
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    const reg = await dev.accountManager.registerAccount({
      username,
      password: oldPassword,
      spaceName: 'Main',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const convs = [{ id: 'c1', name: 'Secret Chat', lastMessage: 'Important secret' }];
    const msgs = { c1: [{ id: 'm1', text: 'Important secret' }] };
    await dev.store.setAsync(reg.session, 'veil:ui:conversations', convs);
    await dev.store.setAsync(reg.session, 'veil:ui:messages', msgs);
    await dev.accountManager.createOrUpdateRecoveryVault(reg.session, oldPassword, username, FAST_TEST_KDF_PARAMS);

    // Change password
    await dev.accountManager.changePassword({
      session: reg.session,
      oldPassword,
      newPassword,
      username,
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Fresh login with new password
    const devFresh = createDevice('Fresh');
    const freshLogin = await devFresh.accountManager.restoreAccount({
      username,
      password: newPassword,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(freshLogin.account.accountId).toBe(reg.account.accountId);
    const restoredConvs = await devFresh.store.getAsync<any[]>(freshLogin.session, 'veil:ui:conversations');
    const restoredMsgs = await devFresh.store.getAsync<Record<string, any[]>>(freshLogin.session, 'veil:ui:messages');

    expect(restoredConvs![0].name).toBe('Secret Chat');
    expect(restoredMsgs!['c1'][0].text).toBe('Important secret');

    // Old password must fail
    const devOld = createDevice('Old Login');
    await expect(
      devOld.accountManager.restoreAccount({
        username,
        password: oldPassword,
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();
  });

  it('Scenario 4: Multiple Independent Accounts and Data Isolation', async () => {
    const dev = createDevice('Device');

    // Register Account 1 (@personal)
    const acc1 = await dev.accountManager.registerAccount({
      username: 'personal_user',
      password: 'PersonalPassword123!',
      spaceName: 'Personal',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    await dev.store.setAsync(acc1.session, 'veil:ui:messages', {
      c1: [{ id: 'm1', text: 'Personal Message' }],
    });
    await dev.accountManager.createOrUpdateRecoveryVault(acc1.session, 'PersonalPassword123!', 'personal_user', FAST_TEST_KDF_PARAMS);

    // Register Account 2 (@work)
    const acc2 = await dev.accountManager.registerAccount({
      username: 'work_user',
      password: 'WorkPassword123!',
      spaceName: 'Work',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    await dev.store.setAsync(acc2.session, 'veil:ui:messages', {
      c2: [{ id: 'm2', text: 'Work Message' }],
    });
    await dev.accountManager.createOrUpdateRecoveryVault(acc2.session, 'WorkPassword123!', 'work_user', FAST_TEST_KDF_PARAMS);

    // Verify Account IDs and Space IDs are distinct
    expect(acc1.account.accountId).not.toBe(acc2.account.accountId);
    expect(acc1.session.spaceId).not.toBe(acc2.session.spaceId);

    // Fresh restore of @personal
    const devP = createDevice('Personal');
    const restoredP = await devP.accountManager.restoreAccount({
      username: 'personal_user',
      password: 'PersonalPassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    const msgsP = await devP.store.getAsync<Record<string, any[]>>(restoredP.session, 'veil:ui:messages');
    expect(msgsP!['c1'][0].text).toBe('Personal Message');
    expect(msgsP!['c2']).toBeUndefined();

    // Fresh restore of @work
    const devW = createDevice('Work');
    const restoredW = await devW.accountManager.restoreAccount({
      username: 'work_user',
      password: 'WorkPassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    const msgsW = await devW.store.getAsync<Record<string, any[]>>(restoredW.session, 'veil:ui:messages');
    expect(msgsW!['c2'][0].text).toBe('Work Message');
    expect(msgsW!['c1']).toBeUndefined();
  });

  it('Scenario 5: Username Collision Rejection at Database Level', async () => {
    const devA = createDevice('Device A');
    const devB = createDevice('Device B');

    // Register @alice_unique
    await devA.accountManager.registerAccount({
      username: 'alice_unique',
      password: 'Password123!',
      spaceName: 'Alice Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Attempting to register identical username must fail
    await expect(
      devB.accountManager.registerAccount({
        username: 'alice_unique',
        password: 'DifferentPassword123!',
        spaceName: 'Duplicate Alice',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();

    // Normalized variation must also fail
    await expect(
      devB.accountManager.registerAccount({
        username: '@ALICE_UNIQUE',
        password: 'DifferentPassword123!',
        spaceName: 'Duplicate Alice Upper',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();
  });
});
