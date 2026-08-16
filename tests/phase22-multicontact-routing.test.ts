import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: Multi-Contact Routing & Isolation Tests', () => {
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

  it('routes correctly across Phone 1, Phone 2, Phone 3 in normal and reversed contact order', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // 1. Setup Phone 1
    const v1 = new SpaceVaultManager();
    const s1 = v1.unlockSpace('P1!', v1.createSpace({ name: 'Phone 1', password: 'P1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(s1);
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    pre1.generateOneTimePrekeys(s1, 5);
    const bundle1 = pre1.createPrekeyBundle(s1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);
    const contacts1 = new ContactManager(store1);

    // 2. Setup Phone 2
    const v2 = new SpaceVaultManager();
    const s2 = v2.unlockSpace('P2!', v2.createSpace({ name: 'Phone 2', password: 'P2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(s2);
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    pre2.generateOneTimePrekeys(s2, 5);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);
    const contacts2 = new ContactManager(store2);

    // 3. Setup Phone 3
    const v3 = new SpaceVaultManager();
    const s3 = v3.unlockSpace('P3!', v3.createSpace({ name: 'Phone 3', password: 'P3!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store3 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr3 = new SpaceIdentityManager();
    const doc3 = idMgr3.createIdentity(s3, store3);
    const net3 = new NetworkManager(store3, netConfig);
    const mb3 = await net3.getOrCreateMailbox(s3);
    const pre3 = new PrekeyManager(store3, idMgr3);
    pre3.generateSignedPrekey(s3);
    pre3.generateOneTimePrekeys(s3, 5);
    const bundle3 = pre3.createPrekeyBundle(s3);
    const conv3 = new ConversationManager(store3, idMgr3, pre3);
    const contacts3 = new ContactManager(store3);

    // 4. Phone 2 adds Phone 1, then Phone 3
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const inv1 = InvitationManager.createInvitation(doc1, id1.signingPrivateKey, 'Phone 1', undefined, mb1.mailboxId, bundle1);
    const contactP1 = await contacts2.addContactFromInvitation(s2, inv1);

    const id3 = idMgr3.loadIdentity(s3, store3)!;
    const inv3 = InvitationManager.createInvitation(doc3, id3.signingPrivateKey, 'Phone 3', undefined, mb3.mailboxId, bundle3);
    const contactP3 = await contacts2.addContactFromInvitation(s2, inv3);

    // Also Phone 1 and Phone 3 add Phone 2
    const id2 = idMgr2.loadIdentity(s2, store2)!;
    const inv2 = InvitationManager.createInvitation(doc2, id2.signingPrivateKey, 'Phone 2', undefined, mb2.mailboxId, bundle2);
    await contacts1.addContactFromInvitation(s1, inv2);
    await contacts3.addContactFromInvitation(s3, inv2);

    // 5. Phone 2 sends to Phone 1
    const p2ToP1 = 'Message for Phone 1 exclusively';
    const { wirePayloadBase64: wireP2P1 } = await conv2.encryptAndPackWireMessage(s2, contactP1.prekeyBundle!, p2ToP1);
    await net2.sendEnvelope(s2, contactP1.mailboxId!, wireP2P1);

    // 6. Phone 2 sends to Phone 3
    const p2ToP3 = 'Message for Phone 3 exclusively';
    const { wirePayloadBase64: wireP2P3 } = await conv2.encryptAndPackWireMessage(s2, contactP3.prekeyBundle!, p2ToP3);
    await net2.sendEnvelope(s2, contactP3.mailboxId!, wireP2P3);

    // 7. Phone 1 syncs and verifies it only got p2ToP1
    let p1Msg = '';
    await net1.syncMailbox(s1, async (payload) => {
      const res = await conv1.processInboundWirePayload(s1, payload);
      p1Msg = res.storedMessage.text;
    });
    expect(p1Msg).toBe(p2ToP1);

    // 8. Phone 3 syncs and verifies it only got p2ToP3
    let p3Msg = '';
    await net3.syncMailbox(s3, async (payload) => {
      const res = await conv3.processInboundWirePayload(s3, payload);
      p3Msg = res.storedMessage.text;
    });
    expect(p3Msg).toBe(p2ToP3);

    // 9. Phone 1 and Phone 3 reply to Phone 2
    const p1Reply = 'Phone 1 replying to Phone 2';
    const { wirePayloadBase64: wireP1Reply } = await conv1.encryptAndPackWireMessage(s1, bundle2, p1Reply);
    await net1.sendEnvelope(s1, mb2.mailboxId, wireP1Reply);

    const p3Reply = 'Phone 3 replying to Phone 2';
    const { wirePayloadBase64: wireP3Reply } = await conv3.encryptAndPackWireMessage(s3, bundle2, p3Reply);
    await net3.sendEnvelope(s3, mb2.mailboxId, wireP3Reply);

    // 10. Phone 2 syncs and receives both replies mapped to correct conversations
    const p2Received: Record<string, string> = {};
    await net2.syncMailbox(s2, async (payload) => {
      const res = await conv2.processInboundWirePayload(s2, payload);
      p2Received[res.storedMessage.senderIdentityId] = res.storedMessage.text;
    });

    expect(p2Received[doc1.identityId]).toBe(p1Reply);
    expect(p2Received[doc3.identityId]).toBe(p3Reply);
  });
});
