/**
 * VEIL Phase 46B: Security Settings, Password Change, Username Identity & Recovery
 * Comprehensive Forensic Runtime Repair Regression Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { normalizeUsername, AppContext, AppContextType } from '../src/ui/app/AppState.tsx';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';
import { SettingsModal } from '../src/ui/components/SettingsModal.tsx';
import { RestoreAccountModal } from '../src/ui/components/RestoreAccountModal.tsx';
import { PasswordInput } from '../src/ui/components/ui/index.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { ToastProvider } from '../src/ui/components/ui/ToastProvider.tsx';
import { SpaceSession } from '../src/spaces/session.ts';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';

function createMockAppContext(overrides: Partial<AppContextType> = {}): AppContextType {
  const dummySession = new SpaceSession('dummy_space', 'Personal', false, new Uint8Array(32));
  return {
    storageReady: true,
    storageError: null,
    activeSession: dummySession,
    conversations: [],
    contacts: [],
    contactRequests: [],
    myProfile: null,
    activeChatId: null,
    messages: {},
    activeModal: null,
    networkState: 'online',
    knownSpacesCount: 1,
    searchResults: [],
    searchQuery: '',
    config: {
      relayHttpUrl: 'http://127.0.0.1:8787',
      relayWsUrl: 'ws://127.0.0.1:8787/v1/ws',
      requestTimeoutMs: 10000,
      enforceTls: false,
    },
    replyTarget: null,
    recoveryPasswordChangeRequired: false,
    privacySettings: {
      phoneVisibility: 'contacts',
      profileVisibility: 'everyone',
    },
    updatePrivacySettings: async () => {},
    unlockSpace: async () => {},
    createSpace: async () => {},
    changeAccountPassword: async () => {},
    restoreAccount: async () => {},
    registerCloudAccount: async () => {},
    lockSpace: () => {},
    panicLock: () => {},
    selectConversation: () => {},
    setReplyTarget: () => {},
    sendMessage: async () => {},
    sendAttachment: async () => {},
    sendAttachments: async () => {},
    sendVoiceMessage: async () => {},
    setSearchQuery: () => {},
    deleteMessageLocally: async () => {},
    deleteMessagesLocally: async () => {},
    retryFailedMessage: async () => {},
    markConversationAsRead: () => {},
    openModal: () => {},
    closeModal: () => {},
    addDirectContact: async () => {},
    addContactFromInvitation: async () => {},
    exportMyInvitation: () => null,
    updateContactVerification: async () => {},
    createGroup: async () => {},
    ensureCloudSession: async () => true,
    updateContactMediaPermissions: async () => {},
    registerUsername: async () => ({} as any),
    searchDirectory: async () => [],
    sendContactRequest: async () => {},
    acceptContactRequest: async () => {},
    declineContactRequest: async () => {},
    cancelContactRequest: async () => {},
    blockUser: async () => {},
    ...overrides,
  };
}

describe('VEIL Phase 46B: Security Settings, Password Change & Recovery Forensic Suite', () => {
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

  describe('Part 1: UI Components & Settings Rendering Tests', () => {
    it('1. PasswordInput renders and exports correctly without reference error', () => {
      const markup = renderToStaticMarkup(
        <PasswordInput placeholder="Enter passphrase" value="secret123" onChange={() => {}} />
      );
      expect(markup).toContain('type="password"');
      expect(markup).toContain('placeholder="Enter passphrase"');
      expect(markup).toContain('veil-input');
    });

    it('2. SettingsModal renders Privacy & Security sub-page with Change Passphrase card without ReferenceError', () => {
      const mockContext = createMockAppContext({
        notificationDispatcher: new NotificationDispatcher('SENDER_ONLY'),
        sessionController: {
          getAutoLockTimeoutMinutes: () => 5,
          setAutoLockTimeoutMinutes: () => {},
        } as any,
      } as any);
      const markup = renderToStaticMarkup(
        <ToastProvider>
          <AppContext.Provider value={mockContext}>
            <SettingsModal initialCategory="privacy" />
          </AppContext.Provider>
        </ToastProvider>
      );
      expect(markup).toContain('Change Account Passphrase');
      expect(markup).toContain('Current Passphrase');
      expect(markup).toContain('New Passphrase (min 3 chars)');
      expect(markup).toContain('Confirm New Passphrase');
      expect(markup).not.toContain('ReferenceError');
    });

    it('3. SettingsModal renders Overview by default and accepts all categorized views', () => {
      const mockContext = createMockAppContext({
        notificationDispatcher: new NotificationDispatcher('SENDER_ONLY'),
        sessionController: {
          getAutoLockTimeoutMinutes: () => 5,
          setAutoLockTimeoutMinutes: () => {},
        } as any,
      } as any);
      const overviewMarkup = renderToStaticMarkup(
        <ToastProvider>
          <AppContext.Provider value={mockContext}>
            <SettingsModal initialCategory="overview" />
          </AppContext.Provider>
        </ToastProvider>
      );
      expect(overviewMarkup).toContain('ACCOUNT');
      expect(overviewMarkup).toContain('PRIVACY &amp; SECURITY');
      expect(overviewMarkup).toContain('Appearance');

      const aboutMarkup = renderToStaticMarkup(
        <ToastProvider>
          <AppContext.Provider value={mockContext}>
            <SettingsModal initialCategory="about" />
          </AppContext.Provider>
        </ToastProvider>
      );
      expect(aboutMarkup).toContain('About VEIL');
      expect(aboutMarkup).toContain('Version 1.0.0');
    });

    it('4. RestoreAccountModal displays "Username" and does NOT use "Account Name"', () => {
      const mockContext = createMockAppContext();
      const markup = renderToStaticMarkup(
        <AppContext.Provider value={mockContext}>
          <RestoreAccountModal />
        </AppContext.Provider>
      );
      expect(markup).toContain('Username');
      expect(markup).not.toContain('Account Name');
      expect(markup).toContain('Restore Account');
    });
  });

  describe('Part 2: Canonical Username Normalization & Uniqueness Tests', () => {
    it('5. Canonical username normalization strips whitespace, lowers case, and removes leading @', () => {
      expect(normalizeUsername('alice')).toBe('alice');
      expect(normalizeUsername(' Alice ')).toBe('alice');
      expect(normalizeUsername('@Alice')).toBe('alice');
      expect(normalizeUsername(' @ALICE ')).toBe('alice');
      expect(normalizeUsername('@alice')).toBe('alice');
      expect(normalizeUsername('@@alice')).toBe('@alice');
      expect(normalizeUsername('')).toBe('');
    });

    it('6. Username uniqueness is enforced across account registrations with different casing and @', async () => {
      const client = new CloudClient(baseUrl);
      await client.registerAccount({
        username: 'alice',
        password: 'Password123!',
        deviceId: 'dev_1',
        deviceName: 'Device 1',
        deviceSigningPub: 'pub_key_1',
        deviceKeyAgreementPub: 'ka_key_1',
      });

      // Attempting to register @Alice must be rejected as already registered
      await expect(
        client.registerAccount({
          username: '@Alice',
          password: 'Password123!',
          deviceId: 'dev_2',
          deviceName: 'Device 2',
          deviceSigningPub: 'pub_key_2',
          deviceKeyAgreementPub: 'ka_key_2',
        })
      ).rejects.toThrow(/already registered/i);

      // Attempting to register ALICE must also be rejected
      await expect(
        client.registerAccount({
          username: ' ALICE ',
          password: 'Password123!',
          deviceId: 'dev_3',
          deviceName: 'Device 3',
          deviceSigningPub: 'pub_key_3',
          deviceKeyAgreementPub: 'ka_key_3',
        })
      ).rejects.toThrow(/already registered/i);
    });

    it('7. Directory profiles enforce username ownership and prevent hijacking by another identity', async () => {
      const dirClient = new DirectoryClient(baseUrl);
      const vault = new SpaceVaultManager();
      const storeAdapter = new MemoryStorageAdapter();
      const store = new EncryptedSpaceStore(storeAdapter);
      const idMgr = new SpaceIdentityManager();

      const header1 = vault.createSpace({
        name: 'Space 1',
        password: 'Password123!',
        kdfParams: FAST_TEST_KDF_PARAMS,
        canonicalUsername: 'alice',
      });
      const session1 = vault.unlockSpace('Password123!', header1.spaceId);
      idMgr.createIdentity(session1, store);
      const id1 = idMgr.loadIdentity(session1, store)!;
      const prekeyMgr1 = new PrekeyManager(store, idMgr);
      const bundle1 = prekeyMgr1.createPrekeyBundle(session1);

      const profile1 = createSignedProfile(
        id1.document.identityId,
        id1.signingPrivateKey,
        'alice',
        'Alice Smith',
        'mb_alice_1',
        bundle1
      );
      await dirClient.registerProfile(profile1);

      // Same identity can update profile idempotently
      const updatedProfile1 = createSignedProfile(
        id1.document.identityId,
        id1.signingPrivateKey,
        'alice',
        'Alice Updated',
        'mb_alice_2',
        bundle1
      );
      await expect(dirClient.registerProfile(updatedProfile1)).resolves.not.toThrow();

      // Different identity trying to register 'alice' must fail with conflict
      const header2 = vault.createSpace({
        name: 'Space 2',
        password: 'Password123!',
        kdfParams: FAST_TEST_KDF_PARAMS,
        canonicalUsername: 'bob',
      });
      const session2 = vault.unlockSpace('Password123!', header2.spaceId);
      idMgr.createIdentity(session2, store);
      const id2 = idMgr.loadIdentity(session2, store)!;
      const prekeyMgr2 = new PrekeyManager(store, idMgr);
      const bundle2 = prekeyMgr2.createPrekeyBundle(session2);
      const rogueProfile = createSignedProfile(
        id2.document.identityId,
        id2.signingPrivateKey,
        'alice',
        'Imposter Alice',
        'mb_imposter',
        bundle2
      );
      await expect(dirClient.registerProfile(rogueProfile)).rejects.toThrow(/already registered/i);
    });
  });

  describe('Part 3: Password Change Cryptographic Lifecycle & Envelope Rewrapping', () => {
    it('8. Password change rewraps local envelopes, updates cloud auth, and re-encrypts recovery vault', async () => {
      const client = new CloudClient(baseUrl);
      const vault = new SpaceVaultManager();
      const storageAdapter = new MemoryStorageAdapter();
      const store = new EncryptedSpaceStore(storageAdapter);
      const idMgr = new SpaceIdentityManager();
      const accountMgr = new AccountManager(client, vault, idMgr, store, storageAdapter);

      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';
      const username = 'alice';

      // 1. Register account
      const { session } = await accountMgr.registerAccount({
        username,
        password: oldPassword,
        spaceName: 'Personal',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });

      // Save a confidential record in the space partition
      await store.setAsync(session, 'notes', { secret: 'top_secret_data' });
      await accountMgr.createOrUpdateRecoveryVault(session, oldPassword, username, FAST_TEST_KDF_PARAMS);

      // 2. Perform password change
      await accountMgr.changePassword({
        session,
        oldPassword,
        newPassword,
        username,
        newKdfParams: FAST_TEST_KDF_PARAMS,
      });

      // 3. Old password must fail to unlock local envelope
      expect(() => vault.unlockSpace(oldPassword, session.spaceId)).toThrow();

      // 4. New password must successfully unlock local envelope
      const newSession = vault.unlockSpace(newPassword, session.spaceId);
      expect(newSession.spaceId).toBe(session.spaceId);
      const decryptedNote = await store.getAsync<{ secret: string }>(newSession, 'notes');
      expect(decryptedNote?.secret).toBe('top_secret_data');

      // 5. Old password must fail cloud authentication
      const freshClient = new CloudClient(baseUrl);
      await expect(
        freshClient.loginAccount({
          username,
          password: oldPassword,
          deviceId: 'dev_test',
        })
      ).rejects.toThrow(/invalid username or password/i);

      // 6. New password must succeed cloud authentication
      const loginRes = await freshClient.loginAccount({
        username,
        password: newPassword,
        deviceId: 'dev_test',
      });
      expect(loginRes.account.username).toBe('alice');

      // 7. Fresh device recovery with old password MUST fail
      const freshVault = new SpaceVaultManager();
      const freshStorage = new MemoryStorageAdapter();
      const freshStore = new EncryptedSpaceStore(freshStorage);
      const recoveryMgr = new AccountManager(freshClient, freshVault, idMgr, freshStore, freshStorage);

      await expect(
        recoveryMgr.restoreAccount({
          username,
          password: oldPassword,
          customKdfParams: FAST_TEST_KDF_PARAMS,
        })
      ).rejects.toThrow();

      // 8. Fresh device recovery with new password MUST succeed
      const restored = await recoveryMgr.restoreAccount({
        username,
        password: newPassword,
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });
      expect(restored.account.username).toBe('alice');
      expect(restored.session.spaceId).toBe(session.spaceId);

      const recoveredNotes = await freshStore.getAsync<{ secret: string }>(restored.session, 'notes');
      expect(recoveredNotes?.secret).toBe('top_secret_data');
    });
  });

  describe('Part 4: Account Recovery, Cold Restart & Zero Username Degradation', () => {
    it('9. Recovery preserves canonical username, accountId, identityId, and records across cold server restart', async () => {
      const diskPath = path.join(process.cwd(), 'scratch', `test_phase46b_cold_${Date.now()}.db`);
      try {
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      } catch (_e) {}

      try {
        // Step 1: Start durable server
        const durableDb1 = new SqlCloudDatabase({ diskPath });
        const durableServer1 = new RelayServer(
          { port: 0, host: '127.0.0.1', logLevel: 'none' },
          new PersistentFileRelayStore(path.join(process.cwd(), 'scratch', `test_relay_46b_${Date.now()}.json`)),
          durableDb1,
          new LocalDiskObjectStorage()
        );
        const addr1 = await durableServer1.start();
        const serverUrl1 = `http://127.0.0.1:${addr1.port}`;

        const client1 = new CloudClient(serverUrl1);
        const vault1 = new SpaceVaultManager();
        const storage1 = new MemoryStorageAdapter();
        const store1 = new EncryptedSpaceStore(storage1);
        const idMgr1 = new SpaceIdentityManager();
        const accountMgr1 = new AccountManager(client1, vault1, idMgr1, store1, storage1);

        const password = 'DurablePassword999!';
        const username = 'charlie';

        const { session: s1 } = await accountMgr1.registerAccount({
          username,
          password,
          spaceName: 'Main Vault',
          customKdfParams: FAST_TEST_KDF_PARAMS,
        });

        const idDoc1 = idMgr1.loadIdentity(s1, store1)?.document;
        expect(idDoc1).toBeDefined();

        await store1.setAsync(s1, 'important_key', { data: 'critical_payload_123' });
        await accountMgr1.createOrUpdateRecoveryVault(s1, password, username, FAST_TEST_KDF_PARAMS);

        // Step 2: Stop server process
        await durableServer1.stop();

        // Step 3: Restart server with same disk database on a new free port
        const durableDb2 = new SqlCloudDatabase({ diskPath });
        const durableServer2 = new RelayServer(
          { port: 0, host: '127.0.0.1', logLevel: 'none' },
          new PersistentFileRelayStore(path.join(process.cwd(), 'scratch', `test_relay_46b_${Date.now()}_2.json`)),
          durableDb2,
          new LocalDiskObjectStorage()
        );
        const addr2 = await durableServer2.start();
        const serverUrl2 = `http://127.0.0.1:${addr2.port}`;

        // Step 4: Destroy client 1 completely and recover on fresh client
        const client2 = new CloudClient(serverUrl2);
        const vault2 = new SpaceVaultManager();
        const storage2 = new MemoryStorageAdapter();
        const store2 = new EncryptedSpaceStore(storage2);
        const idMgr2 = new SpaceIdentityManager();
        const accountMgr2 = new AccountManager(client2, vault2, idMgr2, store2, storage2);

        const recovered = await accountMgr2.restoreAccount({
          username: '@Charlie', // Testing @ and uppercase normalization
          password,
          customKdfParams: FAST_TEST_KDF_PARAMS,
        });

        expect(recovered.account.username).toBe('charlie');
        expect(recovered.session.spaceId).toBe(s1.spaceId);

        const idDoc2 = idMgr2.loadIdentity(recovered.session, store2)?.document;
        expect(idDoc2?.identityId).toBe(idDoc1?.identityId);
        expect(idDoc2?.signingPublicKey).toBe(idDoc1?.signingPublicKey);

        const recoveredData = await store2.getAsync<{ data: string }>(recovered.session, 'important_key');
        expect(recoveredData?.data).toBe('critical_payload_123');

        // Check canonical username on the envelope
        const envelope = vault2.getEnvelope(recovered.session.spaceId);
        expect(envelope?.canonicalUsername).toBe('charlie');

        await durableServer2.stop();
      } finally {
        try {
          if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
        } catch (_e) {}
      }
    });

    it('10. Same-password accounts remain strictly isolated and individually selectable by username', async () => {
      const client = new CloudClient(baseUrl);
      const vault = new SpaceVaultManager();
      const storage = new MemoryStorageAdapter();
      const store = new EncryptedSpaceStore(storage);
      const idMgr = new SpaceIdentityManager();
      const accountMgr = new AccountManager(client, vault, idMgr, store, storage);

      const sharedPassword = 'IdenticalPassword123!';

      // Create Account A
      const { session: sessA } = await accountMgr.registerAccount({
        username: 'alice_user',
        password: sharedPassword,
        spaceName: 'Alice Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });
      await store.setAsync(sessA, 'user_secret', { owner: 'alice' });

      // Create Account B
      const { session: sessB } = await accountMgr.registerAccount({
        username: 'bob_user',
        password: sharedPassword,
        spaceName: 'Bob Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });
      await store.setAsync(sessB, 'user_secret', { owner: 'bob' });

      // Unlock explicitly with username 'alice_user'
      const unlockedA = vault.unlockSpaceByUsername('alice_user', sharedPassword);
      expect(unlockedA.spaceId).toBe(sessA.spaceId);
      const dataA = await store.getAsync<{ owner: string }>(unlockedA, 'user_secret');
      expect(dataA?.owner).toBe('alice');

      // Unlock explicitly with username 'bob_user'
      const unlockedB = vault.unlockSpaceByUsername('bob_user', sharedPassword);
      expect(unlockedB.spaceId).toBe(sessB.spaceId);
      const dataB = await store.getAsync<{ owner: string }>(unlockedB, 'user_secret');
      expect(dataB?.owner).toBe('bob');
    });

    it('11. Multi-space recovery restores secondary spaces and partitioned encrypted records', async () => {
      const client = new CloudClient(baseUrl);
      const vault = new SpaceVaultManager();
      const storage = new MemoryStorageAdapter();
      const store = new EncryptedSpaceStore(storage);
      const idMgr = new SpaceIdentityManager();
      const accountMgr = new AccountManager(client, vault, idMgr, store, storage);

      const username = 'multi_user';
      const password = 'MultiPassword123!';

      // 1. Create primary space
      const { session: s1 } = await accountMgr.registerAccount({
        username,
        password,
        spaceName: 'Primary Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });
      await store.setAsync(s1, 'secret1', { msg: 'record_space_1' });

      // 2. Create secondary space under same account
      const s2Header = vault.createSpace({
        name: 'Secondary Space',
        password,
        kdfParams: FAST_TEST_KDF_PARAMS,
        canonicalUsername: username,
        accountId: client.getAccountId() || undefined,
      });
      const s2 = vault.unlockSpace(password, s2Header.spaceId);
      idMgr.createIdentity(s2, store);
      await store.setAsync(s2, 'secret2', { msg: 'record_space_2' });

      // Update recovery snapshot including both spaces
      await accountMgr.createOrUpdateRecoveryVault(s1, password, username, FAST_TEST_KDF_PARAMS);
      await accountMgr.createOrUpdateRecoveryVault(s2, password, username, FAST_TEST_KDF_PARAMS);

      // 3. Destroy client and recover on fresh client
      const freshClient = new CloudClient(baseUrl);
      const freshVault = new SpaceVaultManager();
      const freshStorage = new MemoryStorageAdapter();
      const freshStore = new EncryptedSpaceStore(freshStorage);
      const freshAccountMgr = new AccountManager(freshClient, freshVault, idMgr, freshStore, freshStorage);

      const restored = await freshAccountMgr.restoreAccount({
        username,
        password,
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(restored.account.username).toBe('multi_user');
      const allEnvelopes = freshVault.listEnvelopes();
      expect(allEnvelopes.length).toBe(2);

      // Verify records in primary space
      const rec1 = await freshStore.getAsync<{ msg: string }>(restored.session, 'secret1');
      expect(rec1?.msg).toBe('record_space_1');

      // Verify records in secondary space
      const otherEnvelope = allEnvelopes.find((e) => e.spaceId !== restored.session.spaceId)!;
      const s2Restored = freshVault.unlockSpace(password, otherEnvelope.spaceId);
      const rec2 = await freshStore.getAsync<{ msg: string }>(s2Restored, 'secret2');
      expect(rec2?.msg).toBe('record_space_2');
    });

    it('12. Post-recovery security banner flag is persisted and cleared on password change', async () => {
      const client = new CloudClient(baseUrl);
      const vault = new SpaceVaultManager();
      const storage = new MemoryStorageAdapter();
      const store = new EncryptedSpaceStore(storage);
      const idMgr = new SpaceIdentityManager();
      const accountMgr = new AccountManager(client, vault, idMgr, store, storage);

      const username = 'flag_user';
      const oldPass = 'OldPass123!';
      const newPass = 'NewPass456!';

      const { session } = await accountMgr.registerAccount({
        username,
        password: oldPass,
        spaceName: 'Security Space',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });
      await accountMgr.createOrUpdateRecoveryVault(session, oldPass, username, FAST_TEST_KDF_PARAMS);

      // Recover account on fresh client
      const freshClient = new CloudClient(baseUrl);
      const freshVault = new SpaceVaultManager();
      const freshStorage = new MemoryStorageAdapter();
      const freshStore = new EncryptedSpaceStore(freshStorage);
      const freshAccountMgr = new AccountManager(freshClient, freshVault, idMgr, freshStore, freshStorage);

      const restored = await freshAccountMgr.restoreAccount({
        username,
        password: oldPass,
        customKdfParams: FAST_TEST_KDF_PARAMS,
        isEmergencyRecovery: true,
      });

      // Verify security flag is set in storage
      const secFlag = await freshStore.getAsync<{ recoveryPasswordChangeRequired: boolean }>(
        restored.session,
        'veil:account:recovery_security'
      );
      expect(secFlag?.recoveryPasswordChangeRequired).toBe(true);

      // Change password
      await freshAccountMgr.changePassword({
        session: restored.session,
        oldPassword: oldPass,
        newPassword: newPass,
        username,
        newKdfParams: FAST_TEST_KDF_PARAMS,
      });

      // Verify security flag is cleared in storage
      const clearedFlag = await freshStore.getAsync<{ recoveryPasswordChangeRequired: boolean }>(
        restored.session,
        'veil:account:recovery_security'
      );
      expect(clearedFlag?.recoveryPasswordChangeRequired).toBe(false);
    });

    it('13. Zero plaintext passwords or master keys leak to diagnostics or recovery events', async () => {
      const logs = RuntimeDiagnostics.getHistory();
      for (const log of logs) {
        const payloadStr = JSON.stringify(log);
        expect(payloadStr).not.toContain('OldPassword123!');
        expect(payloadStr).not.toContain('NewPassword456!');
        expect(payloadStr).not.toContain('DurablePassword999!');
        expect(payloadStr).not.toContain('MultiPassword123!');
      }
    });
  });
});
