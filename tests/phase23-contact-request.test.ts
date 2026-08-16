import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager, ContactRequestWire } from '../src/contacts/contactRequestManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Cryptographic Contact Request Tests', () => {
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

  it('sends cryptographically signed contact request across blind relay mailboxes', async () => {
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
    const bundle1 = pre1.createPrekeyBundle(s1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(s1);
    const contacts1 = new ContactManager(store1);
    const reqMgr1 = new ContactRequestManager(store1, contacts1, idMgr1, net1);

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
    const bundle2 = pre2.createPrekeyBundle(s2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(s2);
    const contacts2 = new ContactManager(store2);
    const reqMgr2 = new ContactRequestManager(store2, contacts2, idMgr2, net2);

    const profile2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'phone2', 'Phone 2', mb2.mailboxId, bundle2);

    // 3. Phone 1 sends contact request to Phone 2
    const outgoingReq = await reqMgr1.sendContactRequest(s1, profile1, profile2, 'Hi Phone 2, let us connect!');
    expect(outgoingReq.status).toBe('OUTGOING_PENDING');
    expect(outgoingReq.peerUsername).toBe('phone2');

    // 4. Phone 2 syncs mailbox and processes request
    let receivedWire: ContactRequestWire | null = null;
    await net2.syncMailbox(s2, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_REQUEST') {
        receivedWire = parsed;
        await reqMgr2.handleInboundRequest(s2, parsed);
      }
    });

    expect(receivedWire).not.toBeNull();
    const incomingRequests = await reqMgr2.listRequests(s2);
    expect(incomingRequests).toHaveLength(1);
    expect(incomingRequests[0].status).toBe('INCOMING_PENDING');
    expect(incomingRequests[0].peerUsername).toBe('phone1');
    expect(incomingRequests[0].greeting).toBe('Hi Phone 2, let us connect!');
  });
});
