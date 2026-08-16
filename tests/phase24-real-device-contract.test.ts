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

describe('VEIL Phase 24: Real-Device Discovery & Bidirectional Contract Tests', () => {
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

  it('executes full real-device discovery contract with 20 bidirectional ratchet messages', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Device A (Phone 1)
    const v1 = new SpaceVaultManager();
    const s1 = v1.unlockSpace('PA!', v1.createSpace({ name: 'Phone 1', password: 'PA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    pre1.generateOneTimePrekeys(s1, 20);
    const bundle1 = pre1.createPrekeyBundle(s1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(s1);
    const contacts1 = new ContactManager(store1);
    const reqMgr1 = new ContactRequestManager(store1, contacts1, idMgr1, net1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'phone1_rd', 'Phone 1 Device', mb1.mailboxId, bundle1);
    await client.registerProfile(profile1);

    // Device B (Phone 2)
    const v2 = new SpaceVaultManager();
    const s2 = v2.unlockSpace('PB!', v2.createSpace({ name: 'Phone 2', password: 'PB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const id2 = idMgr2.loadIdentity(s2, store2)!;
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    pre2.generateOneTimePrekeys(s2, 20);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(s2);
    const contacts2 = new ContactManager(store2);
    const reqMgr2 = new ContactRequestManager(store2, contacts2, idMgr2, net2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);

    const profile2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'phone2_rd', 'Phone 2 Device', mb2.mailboxId, bundle2);
    await client.registerProfile(profile2);

    // Discovery & Request
    const p2Found = (await client.getProfileByUsername('phone2_rd'))!;
    await reqMgr1.sendContactRequest(s1, profile1, p2Found, 'Device A connecting');

    await net2.syncMailbox(s2, async (p) => {
      const parsed = JSON.parse(p);
      if (parsed.type === 'CONTACT_REQUEST') await reqMgr2.handleInboundRequest(s2, parsed);
    });

    const bReqs = await reqMgr2.listRequests(s2);
    await reqMgr2.acceptRequest(s2, bReqs[0].requestId, profile2);

    await net1.syncMailbox(s1, async (p) => {
      const parsed = JSON.parse(p);
      if (parsed.type === 'CONTACT_RESPONSE') await reqMgr1.handleInboundResponse(s1, parsed);
    });

    // 20 Bidirectional Messages
    const cForB = (await contacts1.getContact(s1, doc2.identityId))!;
    const cForA = (await contacts2.getContact(s2, doc1.identityId))!;

    for (let i = 1; i <= 20; i++) {
      if (i % 2 !== 0) {
        const text = `Phone 1 message ${i}`;
        const { wirePayloadBase64 } = await conv1.encryptAndPackWireMessage(s1, cForB.prekeyBundle!, text);
        await net1.sendEnvelope(s1, cForB.mailboxId!, wirePayloadBase64);

        let received = '';
        await net2.syncMailbox(s2, async (p) => {
          const res = await conv2.processInboundWirePayload(s2, p);
          received = res.storedMessage.text;
        });
        expect(received).toBe(text);
      } else {
        const text = `Phone 2 reply ${i}`;
        const { wirePayloadBase64 } = await conv2.encryptAndPackWireMessage(s2, cForA.prekeyBundle!, text);
        await net2.sendEnvelope(s2, cForA.mailboxId!, wirePayloadBase64);

        let received = '';
        await net1.syncMailbox(s1, async (p) => {
          const res = await conv1.processInboundWirePayload(s1, p);
          received = res.storedMessage.text;
        });
        expect(received).toBe(text);
      }
    }
  });
});
