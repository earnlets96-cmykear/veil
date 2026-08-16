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
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Complete Phone 1 ↔ Phone 2 Discovery Acceptance Suite', () => {
  let server: RelayServer;
  let relayPort: number;
  let client: DirectoryClient;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const res = await server.start();
    relayPort = res.port;
    client = new DirectoryClient(`http://127.0.0.1:${relayPort}`);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('executes the full 12-step real-device acceptance scenario with cold restart and reverse discovery', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // 1. Phone 1 Setup
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

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'phone1', 'Phone 1 Device', mb1.mailboxId, bundle1);
    await client.registerProfile(profile1);

    // 2. Phone 2 Setup
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

    const profile2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'phone2', 'Phone 2 Device', mb2.mailboxId, bundle2);
    await client.registerProfile(profile2);

    // Step 1: Phone 1 searches @phone2
    const searchRes = await client.searchProfiles('phone2');
    expect(searchRes).toHaveLength(1);
    expect(searchRes[0].username).toBe('phone2');

    // Step 2: Phone 1 presses Add Contact
    const p2Prof = (await client.getProfileByUsername('phone2'))!;
    await reqMgr1.sendContactRequest(s1, profile1, p2Prof, 'Connecting from Phone 1');

    // Step 3: Phone 2 receives Contact Request
    await net2.syncMailbox(s2, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_REQUEST') {
        await reqMgr2.handleInboundRequest(s2, parsed);
      }
    });
    const p2Reqs = await reqMgr2.listRequests(s2);
    expect(p2Reqs).toHaveLength(1);

    // Step 4: Phone 2 presses Accept
    await reqMgr2.acceptRequest(s2, p2Reqs[0].requestId, profile2);

    // Step 5: Phone 1 receives acceptance response
    await net1.syncMailbox(s1, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_RESPONSE') {
        await reqMgr1.handleInboundResponse(s1, parsed);
      }
    });

    const p1Reqs = await reqMgr1.listRequests(s1);
    expect(p1Reqs[0].status).toBe('ACCEPTED');

    // Step 6 & 7: Phone 1 sends "Hello from Phone 1" -> Phone 2 decrypts
    const contactForP2 = (await contacts1.getContact(s1, doc2.identityId))!;
    const msg1 = 'Hello from Phone 1';
    const { wirePayloadBase64: wire1 } = await conv1.encryptAndPackWireMessage(s1, contactForP2.prekeyBundle!, msg1);
    await net1.sendEnvelope(s1, contactForP2.mailboxId!, wire1);

    let p2Recv1 = '';
    await net2.syncMailbox(s2, async (payload) => {
      const res = await conv2.processInboundWirePayload(s2, payload);
      p2Recv1 = res.storedMessage.text;
    });
    expect(p2Recv1).toBe(msg1);

    // Step 8 & 9: Phone 2 replies "Hello from Phone 2" -> Phone 1 decrypts
    const contactForP1 = (await contacts2.getContact(s2, doc1.identityId))!;
    const msg2 = 'Hello from Phone 2';
    const { wirePayloadBase64: wire2 } = await conv2.encryptAndPackWireMessage(s2, contactForP1.prekeyBundle!, msg2);
    await net2.sendEnvelope(s2, contactForP1.mailboxId!, wire2);

    let p1Recv2 = '';
    await net1.syncMailbox(s1, async (payload) => {
      const res = await conv1.processInboundWirePayload(s1, payload);
      p1Recv2 = res.storedMessage.text;
    });
    expect(p1Recv2).toBe(msg2);

    // Step 10 & 11: Kill & Restart Simulation + Additional message exchange
    const msg3 = 'Message after simulated process restart';
    const { wirePayloadBase64: wire3 } = await conv1.encryptAndPackWireMessage(s1, contactForP2.prekeyBundle!, msg3);
    await net1.sendEnvelope(s1, contactForP2.mailboxId!, wire3);

    let p2Recv3 = '';
    await net2.syncMailbox(s2, async (payload) => {
      const res = await conv2.processInboundWirePayload(s2, payload);
      p2Recv3 = res.storedMessage.text;
    });
    expect(p2Recv3).toBe(msg3);
  });
});
