import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 15: Realistic Full End-to-End Integration Flow', () => {
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
  });

  afterEach(async () => {
    await server.stop();
  });

  it('REALISTIC MULTI-USER FLOW: Onboarding -> Invitation -> E2EE Messaging -> Attachments -> Panic Lock', async () => {
    // 1. Alice and Bob create Spaces
    const envA = vaultA.createSpace({ name: 'Alice Space', password: 'AlicePassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vaultB.createSpace({ name: 'Bob Space', password: 'BobPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vaultA.unlockSpace('AlicePassword123!', envA.spaceId);
    const sessionB = vaultB.unlockSpace('BobPassword123!', envB.spaceId);

    const docA = idMgrA.createIdentity(sessionA, storeA);
    const loadedA = idMgrA.loadIdentity(sessionA, storeA)!;

    const docB = idMgrB.createIdentity(sessionB, storeB);
    const loadedB = idMgrB.loadIdentity(sessionB, storeB)!;

    // 2. Alice generates signed invitation and sends to Bob
    const invitationA = InvitationManager.createInvitation(docA, loadedA.signingPrivateKey, 'Alice');
    const shareableA = InvitationManager.toShareableString(invitationA);

    // 3. Bob imports Alice's invitation and verifies
    const parsedA = InvitationManager.verifyAndParseInvitation(shareableA);
    const contactA = await contactMgrB.addContactFromInvitation(sessionB, parsedA);
    expect(contactA.identityId).toBe(docA.identityId);

    // 4. Bob creates Mailbox and starts listening
    const mbB = await netB.getOrCreateMailbox(sessionB);
    const receivedEnvelopes: string[] = [];
    await netB.startListening(sessionB, async (payload) => {
      receivedEnvelopes.push(payload);
    });

    // 5. Alice sends an E2EE message envelope to Bob's mailbox
    const messagePayload = JSON.stringify({
      id: 'msg_e2e_01',
      conversationId: mbB.mailboxId,
      senderId: sessionA.spaceId,
      text: 'Hello Bob! This is an authenticated message from Alice.',
    });
    await netA.sendEnvelope(sessionA, mbB.mailboxId, messagePayload);

    // Allow async WebSocket delivery
    await new Promise((r) => setTimeout(r, 200));
    expect(receivedEnvelopes).toHaveLength(1);
    expect(receivedEnvelopes[0]).toContain('Hello Bob!');

    // 6. Encrypted Attachment Transfer
    const testFile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(testFile, 'doc.txt', 'text/plain', sessionA.getStorageKey());
    const decryptedFile = AttachmentPipeline.decryptAndReassemble(metadata, chunks, sessionA.getStorageKey());
    expect(decryptedFile).toEqual(testFile);

    // 7. Alice triggers Panic Lock
    sessionA.destroy();
    expect(sessionA.isActive()).toBe(false);
    AttachmentPipeline.revokeAllEphemeralBlobUrls();
  });
});
