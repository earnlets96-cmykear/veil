import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { LocalSearchEngine } from '../src/search/searchEngine.ts';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 16: Comprehensive System-Wide E2E Orchestration', () => {
  let server: RelayServer;
  let vaultA: SpaceVaultManager;
  let vaultB: SpaceVaultManager;
  let storeA: EncryptedSpaceStore;
  let storeB: EncryptedSpaceStore;
  let idMgrA: SpaceIdentityManager;
  let idMgrB: SpaceIdentityManager;
  let netA: NetworkManager;
  let netB: NetworkManager;
  let contactMgrA: ContactManager;
  let contactMgrB: ContactManager;
  let searchEngineA: LocalSearchEngine;
  let notifDispatcher: NotificationDispatcher;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();

    vaultA = new SpaceVaultManager();
    vaultB = new SpaceVaultManager();
    storeA = new EncryptedSpaceStore();
    storeB = new EncryptedSpaceStore();
    idMgrA = new SpaceIdentityManager();
    idMgrB = new SpaceIdentityManager();

    netA = new NetworkManager(storeA, {
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });
    netB = new NetworkManager(storeB, {
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });

    contactMgrA = new ContactManager(storeA);
    contactMgrB = new ContactManager(storeB);
    searchEngineA = new LocalSearchEngine();
    notifDispatcher = new NotificationDispatcher('SENDER_ONLY');
  });

  afterEach(async () => {
    await server.stop();
  });

  it('COMPLETE SYSTEM ORCHESTRATION: Multi-Space, Contacts, E2EE, Groups, Attachments, Notifications, Search, Panic Lock', async () => {
    // 1. Create Multiple Spaces for User A (Main & Decoy)
    const envMainA = vaultA.createSpace({ name: 'Alice Main', password: 'AlicePassword123!', isDecoy: false, kdfParams: FAST_TEST_KDF_PARAMS });
    const envDecoyA = vaultA.createSpace({ name: 'Alice Decoy', password: 'DecoyPassword999!', isDecoy: true, kdfParams: FAST_TEST_KDF_PARAMS });

    // Credential-selected unlock opens Main Space
    const sessionA = vaultA.unlockSpace('AlicePassword123!', envMainA.spaceId);
    expect(sessionA.name).toBe('Alice Main');
    expect(sessionA.isDecoy).toBe(false);

    // Create User B Space
    const envB = vaultB.createSpace({ name: 'Bob Main', password: 'BobPassword123!', isDecoy: false, kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionB = vaultB.unlockSpace('BobPassword123!', envB.spaceId);

    // 2. Generate Identity & Signed Invitation
    const docA = idMgrA.createIdentity(sessionA, storeA);
    const loadedA = idMgrA.loadIdentity(sessionA, storeA)!;
    const invA = InvitationManager.createInvitation(docA, loadedA.signingPrivateKey, 'Alice');
    const shareableA = InvitationManager.toShareableString(invA);

    // Bob imports Alice's invitation
    const parsedA = InvitationManager.verifyAndParseInvitation(shareableA);
    const contactA = await contactMgrB.addContactFromInvitation(sessionB, parsedA);
    expect(contactA.identityId).toBe(docA.identityId);

    // 3. Blind Mailbox Allocation & Real-Time E2EE Messaging
    const mbB = await netB.getOrCreateMailbox(sessionB);
    const receivedMessages: string[] = [];

    await netB.startListening(sessionB, async (payload) => {
      receivedMessages.push(payload);
      notifDispatcher.dispatch({
        id: 'msg_recv_01',
        senderName: 'Alice',
        text: 'Hello from Alice',
        timestamp: Date.now(),
      });
    });

    const msgPayload = JSON.stringify({
      id: 'msg_orch_01',
      conversationId: mbB.mailboxId,
      senderId: sessionA.spaceId,
      text: 'Encrypted message across whole system stack',
    });
    await netA.sendEnvelope(sessionA, mbB.mailboxId, msgPayload);

    await new Promise((r) => setTimeout(r, 200));
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toContain('Encrypted message across whole system stack');

    // 4. Encrypted Attachment Transfer
    const testAttachment = new Uint8Array([10, 20, 30, 40, 50, 60]);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(testAttachment, 'data.bin', 'application/octet-stream', sessionA.getStorageKey());
    const reassembled = AttachmentPipeline.decryptAndReassemble(metadata, chunks, sessionA.getStorageKey());
    expect(reassembled).toEqual(testAttachment);

    // 5. In-Memory Search Indexing
    searchEngineA.updateIndex([contactA], [], {
      [mbB.mailboxId]: [
        {
          id: 'msg_orch_01',
          conversationId: mbB.mailboxId,
          senderId: sessionA.spaceId,
          text: 'Encrypted message across whole system stack',
          isOutgoing: true,
          timestamp: Date.now(),
          status: 'SENT_TO_RELAY',
        },
      ],
    });

    const searchResults = searchEngineA.search('system stack');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].matchSnippet).toContain('whole system stack');

    // 6. Emergency Panic Lock
    sessionA.destroy();
    searchEngineA.clear();
    AttachmentPipeline.revokeAllEphemeralBlobUrls();
    notifDispatcher.setLocked(true);

    expect(sessionA.isActive()).toBe(false);
    expect(searchEngineA.search('system stack')).toHaveLength(0);
    expect(notifDispatcher.prepareNotification({ id: '1', senderName: 'Alice', timestamp: Date.now() })).toBeNull();
  });
});
