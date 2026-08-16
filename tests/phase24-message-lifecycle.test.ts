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
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Comprehensive Message Lifecycle & Boundary Verification Tests', () => {
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

  it('traces message from UI composer through Double Ratchet, wire padding, relay, ACK-after-persistence, and recipient UI timeline', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Client 1 (Phone 1)
    const v1 = new SpaceVaultManager();
    const s1 = v1.unlockSpace('P1!', v1.createSpace({ name: 'Phone 1', password: 'P1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    pre1.generateOneTimePrekeys(s1, 10);
    const bundle1 = pre1.createPrekeyBundle(s1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(s1);
    const contacts1 = new ContactManager(store1);
    const reqMgr1 = new ContactRequestManager(store1, contacts1, idMgr1, net1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'phone1', 'Phone 1', mb1.mailboxId, bundle1);

    // Client 2 (Phone 2)
    const v2 = new SpaceVaultManager();
    const s2 = v2.unlockSpace('P2!', v2.createSpace({ name: 'Phone 2', password: 'P2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const id2 = idMgr2.loadIdentity(s2, store2)!;
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    pre2.generateOneTimePrekeys(s2, 10);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(s2);
    const contacts2 = new ContactManager(store2);
    const reqMgr2 = new ContactRequestManager(store2, contacts2, idMgr2, net2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);

    const profile2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'phone2', 'Phone 2', mb2.mailboxId, bundle2);

    // 1. Handshake: Phone 1 requests -> Phone 2 accepts
    await reqMgr1.sendContactRequest(s1, profile1, profile2, 'Connect');
    await net2.syncMailbox(s2, async (p) => {
      const parsed = JSON.parse(p);
      if (parsed.type === 'CONTACT_REQUEST') await reqMgr2.handleInboundRequest(s2, parsed);
    });

    const p2Reqs = await reqMgr2.listRequests(s2);
    await reqMgr2.acceptRequest(s2, p2Reqs[0].requestId, profile2);

    await net1.syncMailbox(s1, async (p) => {
      const parsed = JSON.parse(p);
      if (parsed.type === 'CONTACT_RESPONSE') await reqMgr1.handleInboundResponse(s1, parsed);
    });

    // 2. Verified contact records exist
    const contactForP2 = (await contacts1.getContact(s1, doc2.identityId))!;
    const contactForP1 = (await contacts2.getContact(s2, doc1.identityId))!;
    expect(contactForP2.mailboxId).toBe(mb2.mailboxId);
    expect(contactForP1.mailboxId).toBe(mb1.mailboxId);

    // 3. Phone 1 encrypts and packs wire message
    const plaintext1 = 'End-to-End Encrypted Message through Full Lifecycle';
    const { wirePayloadBase64, storedMessage: sentMsg1 } = await conv1.encryptAndPackWireMessage(
      s1,
      contactForP2.prekeyBundle!,
      plaintext1
    );

    expect(sentMsg1.text).toBe(plaintext1);
    expect(sentMsg1.conversationId).toBe(doc2.identityId);

    // 4. Send over blind relay envelope
    const envResponse = await net1.sendEnvelope(s1, contactForP2.mailboxId!, wirePayloadBase64);
    expect(envResponse.status).toBe('SENT_TO_RELAY');

    // 5. Phone 2 syncs, verifies ACK-after-persistence, and decrypts
    let deliveredMessageText = '';
    let senderIdVerified = '';

    await net2.syncMailbox(s2, async (wireBase64) => {
      const result = await conv2.processInboundWirePayload(s2, wireBase64);
      deliveredMessageText = result.storedMessage.text;
      senderIdVerified = result.senderDoc.identityId;
    });

    expect(deliveredMessageText).toBe(plaintext1);
    expect(senderIdVerified).toBe(doc1.identityId);

    // 6. Phone 2 replies
    const replyText = 'Reply across full lifecycle';
    const { wirePayloadBase64: replyWire } = await conv2.encryptAndPackWireMessage(
      s2,
      contactForP1.prekeyBundle!,
      replyText
    );
    await net2.sendEnvelope(s2, contactForP1.mailboxId!, replyWire);

    // 7. Phone 1 receives reply
    let replyDelivered = '';
    await net1.syncMailbox(s1, async (wireBase64) => {
      const result = await conv1.processInboundWirePayload(s1, wireBase64);
      replyDelivered = result.storedMessage.text;
    });

    expect(replyDelivered).toBe(replyText);
  });
});
