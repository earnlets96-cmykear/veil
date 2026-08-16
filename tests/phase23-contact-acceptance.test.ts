import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Contact Acceptance & E2EE Convergence Tests', () => {
  let server: RelayServer;
  let relayPort: number;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const res = await server.start();
    relayPort = res.port;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('completes request -> accept handshake and establishes bidirectional Double Ratchet messaging', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // 1. Phone 1 (Alice)
    const vault1 = new SpaceVaultManager();
    const s1 = vault1.unlockSpace('P1!', vault1.createSpace({ name: 'Phone 1', password: 'P1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    pre1.generateOneTimePrekeys(s1, 5);
    const bundle1 = pre1.createPrekeyBundle(s1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(s1);
    const contacts1 = new ContactManager(store1);
    const reqMgr1 = new ContactRequestManager(store1, contacts1, idMgr1, net1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'phone1', 'Phone 1', mb1.mailboxId, bundle1);

    // 2. Phone 2 (Bob)
    const vault2 = new SpaceVaultManager();
    const s2 = vault2.unlockSpace('P2!', vault2.createSpace({ name: 'Phone 2', password: 'P2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const id2 = idMgr2.loadIdentity(s2, store2)!;
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    pre2.generateOneTimePrekeys(s2, 5);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(s2);
    const contacts2 = new ContactManager(store2);
    const reqMgr2 = new ContactRequestManager(store2, contacts2, idMgr2, net2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);

    const profile2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'phone2', 'Phone 2', mb2.mailboxId, bundle2);

    // 3. Phone 1 sends request to Phone 2
    await reqMgr1.sendContactRequest(s1, profile1, profile2, 'Connect with me');

    // 4. Phone 2 receives request
    await net2.syncMailbox(s2, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_REQUEST') {
        await reqMgr2.handleInboundRequest(s2, parsed);
      }
    });

    const p2Requests = await reqMgr2.listRequests(s2);
    expect(p2Requests).toHaveLength(1);
    const incomingReq = p2Requests[0];

    // 5. Phone 2 accepts Phone 1's request
    await reqMgr2.acceptRequest(s2, incomingReq.requestId, profile2);

    // Verify Phone 1 is now in Phone 2's contact list
    const p2Contacts = await contacts2.listContacts(s2);
    expect(p2Contacts).toHaveLength(1);
    expect(p2Contacts[0].identityId).toBe(doc1.identityId);

    // 6. Phone 1 syncs mailbox and receives acceptance response
    await net1.syncMailbox(s1, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_RESPONSE') {
        await reqMgr1.handleInboundResponse(s1, parsed);
      }
    });

    // Verify Phone 2 is now in Phone 1's contact list
    const p1Contacts = await contacts1.listContacts(s1);
    expect(p1Contacts).toHaveLength(1);
    expect(p1Contacts[0].identityId).toBe(doc2.identityId);

    // 7. Now Phone 1 sends E2EE message to Phone 2 using contact record
    const textMsg = 'Hello Phone 2, contact established via discovery!';
    const { wirePayloadBase64 } = await conv1.encryptAndPackWireMessage(s1, p1Contacts[0].prekeyBundle!, textMsg);
    await net1.sendEnvelope(s1, p1Contacts[0].mailboxId!, wirePayloadBase64);

    // 8. Phone 2 syncs and decrypts message
    let decryptedText = '';
    await net2.syncMailbox(s2, async (payload) => {
      const res = await conv2.processInboundWirePayload(s2, payload);
      decryptedText = res.storedMessage.text;
    });

    expect(decryptedText).toBe(textMsg);
  });
});
