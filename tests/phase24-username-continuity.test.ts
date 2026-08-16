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
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Username Continuity Across Identity Life Cycle Tests', () => {
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

  it('maintains continuous Double Ratchet conversation history when a peer updates their username', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Client 1 (Alice)
    const v1 = new SpaceVaultManager();
    const s1 = v1.unlockSpace('P1!', v1.createSpace({ name: 'Alice', password: 'P1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    const bundle1 = pre1.createPrekeyBundle(s1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(s1);
    const contacts1 = new ContactManager(store1);
    const reqMgr1 = new ContactRequestManager(store1, contacts1, idMgr1, net1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'alice_cont', 'Alice', mb1.mailboxId, bundle1);
    await client.registerProfile(profile1);

    // Client 2 (Bob - initial handle: bob_v1)
    const v2 = new SpaceVaultManager();
    const s2 = v2.unlockSpace('P2!', v2.createSpace({ name: 'Bob', password: 'P2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const id2 = idMgr2.loadIdentity(s2, store2)!;
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(s2);
    const contacts2 = new ContactManager(store2);
    const reqMgr2 = new ContactRequestManager(store2, contacts2, idMgr2, net2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);

    const profile2_v1 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'bob_v1', 'Bob Initial', mb2.mailboxId, bundle2);
    await client.registerProfile(profile2_v1);

    // 1. Initial contact handshake under @bob_v1
    await reqMgr1.sendContactRequest(s1, profile1, profile2_v1);
    await net2.syncMailbox(s2, async (p) => {
      const parsed = JSON.parse(p);
      if (parsed.type === 'CONTACT_REQUEST') await reqMgr2.handleInboundRequest(s2, parsed);
    });
    const bReqs = await reqMgr2.listRequests(s2);
    await reqMgr2.acceptRequest(s2, bReqs[0].requestId, profile2_v1);
    await net1.syncMailbox(s1, async (p) => {
      const parsed = JSON.parse(p);
      if (parsed.type === 'CONTACT_RESPONSE') await reqMgr1.handleInboundResponse(s1, parsed);
    });

    // 2. Exchange initial message
    const contactB = (await contacts1.getContact(s1, doc2.identityId))!;
    const { wirePayloadBase64: wire1 } = await conv1.encryptAndPackWireMessage(s1, contactB.prekeyBundle!, 'Message 1 before rename');
    await net1.sendEnvelope(s1, contactB.mailboxId!, wire1);
    await net2.syncMailbox(s2, async (p) => {
      const res = await conv2.processInboundWirePayload(s2, p);
      expect(res.storedMessage.text).toBe('Message 1 before rename');
    });

    // 3. Bob changes his username to @bob_v2
    const profile2_v2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'bob_v2', 'Bob Updated', mb2.mailboxId, bundle2);
    await client.updateProfile(profile2_v2);

    // 4. Alice sends second message
    const { wirePayloadBase64: wire2 } = await conv1.encryptAndPackWireMessage(s1, contactB.prekeyBundle!, 'Message 2 after rename');
    await net1.sendEnvelope(s1, contactB.mailboxId!, wire2);

    let deliveredText2 = '';
    await net2.syncMailbox(s2, async (p) => {
      const res = await conv2.processInboundWirePayload(s2, p);
      deliveredText2 = res.storedMessage.text;
    });

    expect(deliveredText2).toBe('Message 2 after rename');
  });
});
