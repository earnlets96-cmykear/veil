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

describe('VEIL Phase 23: E2EE Discovery & Multi-Message Ratchet Tests', () => {
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

  it('searches user, requests contact, accepts, and exchanges 10 ratchet messages', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Client 1 (Alice)
    const vault1 = new SpaceVaultManager();
    const s1 = vault1.unlockSpace('P1!', vault1.createSpace({ name: 'Alice', password: 'P1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
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

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'alice_secure', 'Alice Secure', mb1.mailboxId, bundle1);
    await client.registerProfile(profile1);

    // Client 2 (Bob)
    const vault2 = new SpaceVaultManager();
    const s2 = vault2.unlockSpace('P2!', vault2.createSpace({ name: 'Bob', password: 'P2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
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

    const profile2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'bob_secure', 'Bob Secure', mb2.mailboxId, bundle2);
    await client.registerProfile(profile2);

    // 1. Alice searches for "bob"
    const searchResults = await client.searchProfiles('bob');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].username).toBe('bob_secure');

    // 2. Alice fetches Bob's full profile
    const targetProfile = await client.getProfileByUsername('bob_secure');
    expect(targetProfile).not.toBeNull();

    // 3. Alice sends contact request to Bob
    await reqMgr1.sendContactRequest(s1, profile1, targetProfile!, 'Hello Bob!');

    // 4. Bob receives request
    await net2.syncMailbox(s2, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_REQUEST') {
        await reqMgr2.handleInboundRequest(s2, parsed);
      }
    });

    const bobRequests = await reqMgr2.listRequests(s2);
    expect(bobRequests).toHaveLength(1);

    // 5. Bob accepts request
    await reqMgr2.acceptRequest(s2, bobRequests[0].requestId, profile2);

    // 6. Alice receives acceptance
    await net1.syncMailbox(s1, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_RESPONSE') {
        await reqMgr1.handleInboundResponse(s1, parsed);
      }
    });

    // 7. Exchange 10 consecutive E2EE messages
    const aliceContactForBob = (await contacts1.getContact(s1, doc2.identityId))!;
    const bobContactForAlice = (await contacts2.getContact(s2, doc1.identityId))!;

    for (let i = 1; i <= 10; i++) {
      if (i % 2 !== 0) {
        // Alice -> Bob
        const text = `Alice message #${i}`;
        const { wirePayloadBase64 } = await conv1.encryptAndPackWireMessage(s1, aliceContactForBob.prekeyBundle!, text);
        await net1.sendEnvelope(s1, aliceContactForBob.mailboxId!, wirePayloadBase64);

        let received = '';
        await net2.syncMailbox(s2, async (payload) => {
          const res = await conv2.processInboundWirePayload(s2, payload);
          received = res.storedMessage.text;
        });
        expect(received).toBe(text);
      } else {
        // Bob -> Alice
        const text = `Bob reply #${i}`;
        const { wirePayloadBase64 } = await conv2.encryptAndPackWireMessage(s2, bobContactForAlice.prekeyBundle!, text);
        await net2.sendEnvelope(s2, bobContactForAlice.mailboxId!, wirePayloadBase64);

        let received = '';
        await net1.syncMailbox(s1, async (payload) => {
          const res = await conv1.processInboundWirePayload(s1, payload);
          received = res.storedMessage.text;
        });
        expect(received).toBe(text);
      }
    }
  });
});
