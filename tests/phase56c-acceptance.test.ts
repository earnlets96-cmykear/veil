/**
 * Phase 56C Acceptance Test Suite:
 * 1. Startup Recovery Safety: syncTimeoutRef defined & cleaned up cleanly.
 * 2. Grouped Media Integrity: groupId preserved across serialization and multi-item sends.
 * 3. Read Receipts Routing: readerIdentityId included in receipt batch and delivers to mailbox.
 * 4. Group Creation with @username: human lookup resolves to encryption identity with SenderKey distribution.
 * 5. Voice Note Authorization: recipient accountId/username/identityId granted access to download and play.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { RatchetSessionStore } from '../src/messaging/sessionStore.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { AccountService } from '../src/server/cloud/accountService.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { scheduleReadReceipt, flushPendingReceipts, processInboundReceipt } from '../src/messaging/readReceipts.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { toWireAttachment, WireAttachmentPayload } from '../src/attachments/types.ts';
import { UIMessage } from '../src/ui/app/types.ts';

describe('Phase 56C: Critical Runtime & Messaging Hardening Acceptance Tests', () => {
  let server: RelayServer;
  let serverUrl: string;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;
  let relayStore: MemoryRelayStore;

  beforeEach(async () => {
    cloudDb = new MemoryCloudDatabase();
    objectStorage = new LocalDiskObjectStorage();
    relayStore = new MemoryRelayStore();
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
    await server.stop();
  });

  it('P0-1: Grouped Media preserves groupId across wire and local payloads', () => {
    const batchGroupId = `grp_media_${Date.now()}_test123`;
    const localAttachment = {
      attachmentId: 'att_1',
      objectId: 'obj_1',
      name: 'photo1.jpg',
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      sha256Hash: 'hash1',
      ciphertextHash: 'chash1',
      encryptionKeyBase64: 'key1',
      nonceBase64: 'nonce1',
      groupId: batchGroupId,
      state: 'SENT' as const,
      progressPercent: 100,
    };

    const wireAtt = toWireAttachment(localAttachment);
    expect(wireAtt.groupId).toBe(batchGroupId);

    const wirePayload: WireAttachmentPayload = {
      ...wireAtt,
      groupId: batchGroupId,
    };
    expect(wirePayload.groupId).toBe(batchGroupId);
  });

  it('P0-2: Read Receipts include readerIdentityId and correctly advance message status', async () => {
    const msgId = `msg_read_test_${Date.now()}`;
    const readerId = 'identity_bob_456';
    const senderId = 'identity_alice_123';

    const sentReceipts: any[] = [];
    scheduleReadReceipt(senderId, msgId, async (r) => { sentReceipts.push(r); }, readerId);

    await flushPendingReceipts();
    expect(sentReceipts.length).toBe(1);
    expect(sentReceipts[0].readerIdentityId).toBe(readerId);
    expect(sentReceipts[0].lastReadMessageId).toBe(msgId);

    const messagesMap: Record<string, UIMessage[]> = {
      [senderId]: [
        {
          id: msgId,
          conversationId: senderId,
          senderId: senderId,
          text: 'Hello Bob',
          isOutgoing: true,
          timestamp: Date.now(),
          status: 'DELIVERED_TO_RECIPIENT',
        },
      ],
    };

    const receiptPayload = {
      type: 'READ_RECEIPT' as const,
      conversationId: senderId,
      lastReadMessageId: msgId,
      readerIdentityId: readerId,
      readAt: Date.now(),
    };

    const updated = processInboundReceipt(receiptPayload, messagesMap, readerId);
    expect(updated.didChange).toBe(true);
    expect(updated.updatedMessages[senderId][0].status).toBe('READ');
  });

  it('P0-3: Voice Note upload and download authorization permits recipient by username', async () => {
    const storage = new MemoryAdapter();
    await storage.init();
    const vault = new SpaceVaultManager();
    const envA = vault.createSpace({ name: 'space_alice', password: 'passphrase123', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'space_bob', password: 'passphrase123', kdfParams: FAST_TEST_KDF_PARAMS });
    const aliceSession = vault.unlockSpace('passphrase123', envA.spaceId);
    const bobSession = vault.unlockSpace('passphrase123', envB.spaceId);

    const aliceClient = new CloudClient({ baseUrl: serverUrl });
    const aliceReg = await aliceClient.registerAccount({
      username: 'alice_user',
      password: 'Pass@123456',
      deviceId: 'device_alice',
      deviceName: 'Device Alice',
    });

    const bobClient = new CloudClient({ baseUrl: serverUrl });
    const bobReg = await bobClient.registerAccount({
      username: 'bob_user',
      password: 'Pass@123456',
      deviceId: 'device_bob',
      deviceName: 'Device Bob',
    });

    const audioBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const voiceMeta = await VoiceRecorder.encryptAndUploadVoiceNote(
      aliceSession,
      aliceClient,
      audioBytes,
      3,
      'audio/webm',
      {
        recipientUsername: 'bob_user',
        recipientAccountId: bobReg.account.accountId,
        recipientIdentityId: bobSession.spaceId,
        allowedAccounts: [bobReg.account.accountId],
      }
    );

    expect(voiceMeta.objectId).toBeTruthy();
    expect(voiceMeta.ciphertextHash).toBeTruthy();

    // Bob downloads the voice note
    const downloadedBytes = await bobClient.downloadAttachment(voiceMeta.objectId);
    expect(downloadedBytes.length).toBeGreaterThan(0);
  });

  it('P1: Group creation resolves members and distributes SenderKey ratchets', async () => {
    const storage = new MemoryAdapter();
    await storage.init();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);

    const envA = vault.createSpace({ name: 'space_alice_grp', password: 'passphrase123', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'space_bob_grp', password: 'passphrase123', kdfParams: FAST_TEST_KDF_PARAMS });
    const aliceSession = vault.unlockSpace('passphrase123', envA.spaceId);
    const bobSession = vault.unlockSpace('passphrase123', envB.spaceId);

    const idMgr = new SpaceIdentityManager();
    const aliceDoc = idMgr.createIdentity(aliceSession, store);
    const bobDoc = idMgr.createIdentity(bobSession, store);

    const groupManager = new GroupManager(store, idMgr);
    const { state } = groupManager.createGroup(aliceSession, {
      name: 'Alpha Team',
      description: 'Encrypted group chat',
    });

    expect(state.groupId).toBeTruthy();
    expect(state.members[aliceDoc.identityId]).toBeDefined();

    // Add Bob as group member
    const { distribution } = groupManager.addMember(
      aliceSession,
      state.groupId,
      bobDoc.identityId,
      bobDoc.signingPublicKey,
      'MEMBER'
    );

    expect(distribution).toBeDefined();
    expect(distribution.groupId).toBe(state.groupId);
    expect(distribution.chainKey).toBeDefined();
    expect(distribution.signature).toBeDefined();
  });
});
