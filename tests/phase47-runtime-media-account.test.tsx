/**
 * VEIL Phase 47: Comprehensive Runtime Media, Account, Password & Profile Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RelayServer } from '../src/server/relayServer.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { AppContext, AppContextType } from '../src/ui/app/AppState.tsx';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { ProfileModal } from '../src/ui/components/ProfileModal.tsx';
import { MessageStatus } from '../src/ui/components/ui/MessageStatus.tsx';
import { ToastProvider } from '../src/ui/components/ui/ToastProvider.tsx';
import { SpaceSession } from '../src/spaces/session.ts';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { getErrorMessage } from '../src/utils/errors.ts';
import { AccountService } from '../src/server/cloud/accountService.ts';
import { RecoveryVault } from '../src/recovery/recoveryVault.ts';

function createMockAppContext(overrides: Partial<AppContextType> = {}): AppContextType {
  const dummySession = new SpaceSession('dummy_space', 'Personal', false, new Uint8Array(32));
  const storageAdapter = new MemoryStorageAdapter();
  const store = new EncryptedSpaceStore(storageAdapter);
  const vault = new SpaceVaultManager();
  const idMgr = new SpaceIdentityManager();
  const cloudClient = new CloudClient('http://127.0.0.1:8787');
  const directoryClient = new DirectoryClient('http://127.0.0.1:8787');
  const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);
  const prekeyManager = new PrekeyManager(store, idMgr);

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
    setReplyTarget: () => {},
    createSpace: async () => dummySession,
    unlockSpace: async () => dummySession,
    restoreAccount: async () => dummySession,
    changeAccountPassword: async () => {},
    lockSpace: () => {},
    panicLock: async () => {},
    selectConversation: () => {},
    sendMessage: async () => {},
    sendAttachments: async () => {},
    sendVoiceMessage: async () => {},
    addReaction: async () => {},
    removeReaction: async () => {},
    deleteMessage: async () => {},
    editMessage: async () => {},
    setDisappearingTimer: async () => {},
    openModal: () => {},
    closeModal: () => {},
    retryFailedMessage: async () => {},
    updateContactVerification: async () => {},
    updateContactMediaPermissions: async () => {},
    updatePrivacySettings: async () => {},
    registerUsername: async () => {},
    searchDirectory: async () => [],
    sendContactRequest: async () => {},
    acceptContactRequest: async () => {},
    declineContactRequest: async () => {},
    cancelContactRequest: async () => {},
    blockUser: async () => {},
    unblockUser: async () => {},
    removeContact: async () => {},
    addContactFromInvitation: async () => {},
    addDirectContact: async () => {},
    createGroup: async () => 'grp_123',
    leaveGroup: async () => {},
    renameGroup: async () => {},
    setDecoyPassword: async () => {},
    removeDecoyPassword: async () => {},
    hasDecoyPassword: false,
    privacySettings: {
      bio: 'Privacy advocate',
      phoneNumber: '+1 555 0199',
      phoneVisibility: 'contacts',
      profileVisibility: 'everyone',
      autoLockSeconds: 300,
      appLockEnabled: true,
      lastSeenPrivacy: 'contacts',
      readReceiptsEnabled: true,
      typingIndicatorsEnabled: true,
      contactSyncEnabled: false,
    },
    cloudClient,
    directoryClient,
    idMgr,
    vault,
    store,
    notificationDispatcher: new NotificationDispatcher(),
    prekeyManager,
    accountManager,
    ...overrides,
  };
}

describe('Phase 47 Forensic Runtime Verification', () => {
  let server: RelayServer;
  let testPort: number;
  let baseUrl: string;
  let tempDir: string;
  let relayStore: PersistentFileRelayStore;
  let cloudDb: SqlCloudDatabase;
  let objectStore: LocalDiskObjectStorage;

  beforeEach(async () => {
    testPort = 9800 + Math.floor(Math.random() * 150);
    baseUrl = `http://127.0.0.1:${testPort}`;
    tempDir = path.join(process.cwd(), 'scratch', `phase47_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
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

  it('1. Enforces 3-character minimum password standard (accepts 3 chars, rejects 2 chars)', async () => {
    const accountService = new AccountService(cloudDb);
    const u1 = `u1_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 2-character password should throw
    await expect(
      accountService.registerAccount({
        username: u1,
        password: '12',
      })
    ).rejects.toThrow('Password must be at least 3 characters long');

    // 3-character password succeeds
    const regRes = await accountService.registerAccount({
      username: u1,
      password: '123',
    });
    expect(regRes.account.username).toBe(u1);

    // Password change with 2 chars should throw
    await expect(
      accountService.changePassword({
        accountId: regRes.account.accountId,
        oldPassword: '123',
        newPassword: 'ab',
      })
    ).rejects.toThrow('New password must be at least 3 characters long');

    // Password change with 3 chars succeeds
    await accountService.changePassword({
      accountId: regRes.account.accountId,
      oldPassword: '123',
      newPassword: 'abc',
    });

    // Verify recovery vault creation with 3-char passphrase
    const dummySession = new SpaceSession('sp_1', 'Personal', false, new Uint8Array(32));
    const vault = RecoveryVault.exportEncryptedRecoveryFile(dummySession, 'Personal', 'xyz', FAST_TEST_KDF_PARAMS);
    expect(vault.encryptedPayload).toBeDefined();

    // 2-char passphrase in recovery vault throws
    expect(() => {
      RecoveryVault.exportEncryptedRecoveryFile(dummySession, 'Personal', 'xy', FAST_TEST_KDF_PARAMS);
    }).toThrow('Recovery passphrase must be at least 3 characters long');
  });

  it('2. Completes full password change lifecycle and rewraps local envelopes', async () => {
    const cloudClient = new CloudClient(baseUrl);
    const storageAdapter = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storageAdapter);
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const accountMgr = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);
    const u2 = `u2_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Register account with initial password 'oldpass123'
    const regRes = await accountMgr.registerAccount({
      username: u2,
      password: 'oldpass123',
      spaceName: 'Charlie Personal',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(regRes.session).toBeDefined();
    const env = vault.getEnvelope(regRes.session.spaceId);
    expect(env?.canonicalUsername).toBe(u2);

    // Execute password change to 'newpass456'
    await accountMgr.changePassword({
      session: regRes.session,
      oldPassword: 'oldpass123',
      newPassword: 'newpass456',
      username: u2,
      newKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Test unlock with old password should fail
    expect(() => {
      vault.unlockSpace('oldpass123', regRes.session.spaceId);
    }).toThrow();

    // Test unlock with new password succeeds
    const reUnlocked = vault.unlockSpace('newpass456', regRes.session.spaceId);
    expect(reUnlocked.spaceId).toBe(regRes.session.spaceId);
    expect(reUnlocked.getMasterKey()).toEqual(regRes.session.getMasterKey());
  });

  it('3. Normalizes directory search queries (@alice, ALICE, alice) across same-device accounts', async () => {
    const directoryClient = new DirectoryClient(baseUrl);
    const idMgr = new SpaceIdentityManager();
    const storageAdapter = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storageAdapter);
    const session = new SpaceSession('space_bob', 'Bob Space', false, new Uint8Array(32));

    await idMgr.createIdentity(session, store, 'Bob Secure');
    const prekeyMgr = new PrekeyManager(store, idMgr);
    const bundle = prekeyMgr.generatePrekeyBundle(session);

    // Register Bob in directory
    const prof = {
      protocolVersion: 1,
      identityId: bundle.identityDocument.identityId,
      username: 'bob',
      displayName: 'Bob Secure',
      mailboxId: 'mb_bob',
      prekeyBundle: bundle,
      issuedAt: Date.now(),
      signature: 'test_sig',
    };
    await relayStore.registerProfile(prof as any);

    // Search queries: '@bob', 'bob', 'BOB', ' bob '
    const res1 = await directoryClient.searchProfiles('@bob');
    expect(res1.length).toBeGreaterThan(0);
    expect(res1[0].username).toBe('bob');

    const res2 = await directoryClient.searchProfiles('BOB');
    expect(res2.length).toBeGreaterThan(0);
    expect(res2[0].username).toBe('bob');

    const res3 = await directoryClient.searchProfiles(' bob ');
    expect(res3.length).toBeGreaterThan(0);
    expect(res3[0].username).toBe('bob');
  });

  it('4. Correctly handles video MIME type inference and chunked encryption pipeline', () => {
    const videoData = new Uint8Array(1024 * 128); // 128 KiB
    videoData.fill(42);
    const key = new Uint8Array(32);
    key.fill(7);

    // Chunk and encrypt video
    const encResult = AttachmentPipeline.chunkAndEncrypt(
      videoData,
      'recording.mp4',
      'video/mp4',
      key,
      64 * 1024
    );

    expect(encResult.metadata.chunkCount).toBe(2);
    expect(encResult.metadata.mimeType).toBe('video/mp4');
    expect(encResult.chunks.length).toBe(2);

    // Decrypt and reassemble
    const decrypted = AttachmentPipeline.decryptAndReassemble(
      encResult.metadata,
      encResult.chunks,
      key
    );

    expect(decrypted.length).toBe(videoData.length);
    expect(decrypted).toEqual(videoData);
  });

  it('5. Renders Telegram-style MessageStatus with SVG animations and no unicode symbols', () => {
    // SENDING
    const sendingHtml = renderToStaticMarkup(<MessageStatus status="SENDING" size={16} />);
    expect(sendingHtml).toContain('veil-msg-status-spinner');
    expect(sendingHtml).toContain('<svg');
    expect(sendingHtml).not.toContain('🔄');

    // UPLOADING with percentage
    const uploadingHtml = renderToStaticMarkup(<MessageStatus status="UPLOADING" size={16} uploadProgress={50} />);
    expect(uploadingHtml).toContain('Uploading 50%');
    expect(uploadingHtml).toContain('stroke-dasharray');

    // READ
    const readHtml = renderToStaticMarkup(<MessageStatus status="READ" size={16} />);
    expect(readHtml).toContain('veil-msg-status');
  });

  it('6. Renders ProfileModal in Telegram reference structure with categorized media counts', () => {
    const mockContext = createMockAppContext({
      contacts: [
        {
          identityId: 'peer_identity_1',
          name: 'Dave',
          accountUsername: 'dave',
          verificationStatus: 'VERIFIED',
          fingerprint: '1234567890123456',
        } as any,
      ],
      messages: {
        peer_identity_1: [
          {
            id: 'm1',
            conversationId: 'peer_identity_1',
            senderId: 'peer_identity_1',
            text: 'Check this link: https://veil.crypto',
            isOutgoing: false,
            timestamp: Date.now(),
            status: 'READ',
          },
          {
            id: 'm2',
            conversationId: 'peer_identity_1',
            senderId: 'peer_identity_1',
            text: '',
            isOutgoing: false,
            timestamp: Date.now(),
            status: 'READ',
            attachment: {
              attachmentId: 'att_v1',
              name: 'demo.mp4',
              sizeBytes: 50000,
              mimeType: 'video/mp4',
            },
          },
          {
            id: 'm3',
            conversationId: 'peer_identity_1',
            senderId: 'peer_identity_1',
            text: '',
            isOutgoing: false,
            timestamp: Date.now(),
            status: 'READ',
            attachment: {
              attachmentId: 'att_p1',
              name: 'avatar.png',
              sizeBytes: 12000,
              mimeType: 'image/png',
            },
          },
        ],
      },
    });

    const html = renderToStaticMarkup(
      <ToastProvider>
        <AppContext.Provider value={mockContext}>
          <ProfileModal
            peerId="peer_identity_1"
            peerUsername="dave"
          />
        </AppContext.Provider>
      </ToastProvider>
    );

    // Assert Header & Primary Actions exist
    expect(html).toContain('Message');
    expect(html).toContain('Mute');
    expect(html).toContain('Call');
    expect(html).toContain('Safety');

    // Assert Identity info
    expect(html).toContain('@dave');
    expect(html).toContain('Mobile');

    // Assert Media section counts
    expect(html).toContain('1 photos');
    expect(html).toContain('1 videos');
    expect(html).toContain('1 shared links');

    // Assert Contact actions
    expect(html).toContain('Share this contact');
    expect(html).toContain('Verify Safety Number');
  });

  it('7. Normalizes error structures and guarantees zero [object Object] leaks', () => {
    expect(getErrorMessage(new Error('Cryptographic failure'))).toBe('Cryptographic failure');
    expect(getErrorMessage('Raw string error')).toBe('Raw string error');
    expect(getErrorMessage({ message: 'Nested message error' })).toBe('Nested message error');
    expect(getErrorMessage({ error: { message: 'Deep error message' } })).toBe('Deep error message');
    expect(getErrorMessage({ detail: 'Postgres detail error' })).toBe('Postgres detail error');
    expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred.');
    expect(getErrorMessage('[object Object]')).toBe('An unexpected error occurred.');
  });
});
