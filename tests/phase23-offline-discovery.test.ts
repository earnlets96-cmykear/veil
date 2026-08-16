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
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Offline Discovery & Reconnect Catch-Up Tests', () => {
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

  it('queues contact requests and responses while offline and recovers upon reconnection', async () => {
    const offlineConfig = {
      httpUrl: 'http://127.0.0.1:59998',
      wsUrl: 'ws://127.0.0.1:59998/v1/ws',
    };
    const onlineConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Setup Alice (offline)
    const vaultA = new SpaceVaultManager();
    const sA = vaultA.unlockSpace('PA!', vaultA.createSpace({ name: 'Alice', password: 'PA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    const docA = idMgrA.createIdentity(sA, storeA);
    const idA = idMgrA.loadIdentity(sA, storeA)!;
    const preA = new PrekeyManager(storeA, idMgrA);
    preA.generateSignedPrekey(sA);
    const netSetupA = new NetworkManager(storeA, onlineConfig);
    const mbA = await netSetupA.getOrCreateMailbox(sA);
    const netOfflineA = new NetworkManager(storeA, offlineConfig);
    const contactsA = new ContactManager(storeA);
    const bundleA = preA.createPrekeyBundle(sA);
    const reqMgrA = new ContactRequestManager(storeA, contactsA, idMgrA, netOfflineA);
    const profileA = createSignedProfile(docA.identityId, idA.signingPrivateKey, 'alice_off', 'Alice', mbA.mailboxId, bundleA);

    // Setup Bob (online)
    const vaultB = new SpaceVaultManager();
    const sB = vaultB.unlockSpace('PB!', vaultB.createSpace({ name: 'Bob', password: 'PB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    const docB = idMgrB.createIdentity(sB, storeB);
    const idB = idMgrB.loadIdentity(sB, storeB)!;
    const preB = new PrekeyManager(storeB, idMgrB);
    preB.generateSignedPrekey(sB);
    const bundleB = preB.createPrekeyBundle(sB);
    const netOnlineB = new NetworkManager(storeB, onlineConfig);
    const mbB = await netOnlineB.getOrCreateMailbox(sB);
    const contactsB = new ContactManager(storeB);
    const reqMgrB = new ContactRequestManager(storeB, contactsB, idMgrB, netOnlineB);

    const profileB = createSignedProfile(docB.identityId, idB.signingPrivateKey, 'bob_on', 'Bob', mbB.mailboxId, bundleB);

    // 1. Alice sends request while offline -> enqueued locally
    await reqMgrA.sendContactRequest(sA, profileA, profileB, 'Offline greeting');
    const outboundA = await netOfflineA.getQueue().listOutbound(sA);
    expect(outboundA).toHaveLength(1);

    // 2. Alice comes online and flushes outbound queue
    const netOnlineA = new NetworkManager(storeA, onlineConfig);
    const flushed = await netOnlineA.flushOutboundQueue(sA);
    expect(flushed).toBe(1);

    // 3. Bob receives request
    await netOnlineB.syncMailbox(sB, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_REQUEST') {
        await reqMgrB.handleInboundRequest(sB, parsed);
      }
    });

    const bobReqs = await reqMgrB.listRequests(sB);
    expect(bobReqs).toHaveLength(1);
    expect(bobReqs[0].status).toBe('INCOMING_PENDING');

    // 4. Bob accepts request
    await reqMgrB.acceptRequest(sB, bobReqs[0].requestId, profileB);

    // 5. Alice syncs and processes acceptance
    await netOnlineA.syncMailbox(sA, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_RESPONSE') {
        await reqMgrA.handleInboundResponse(sA, parsed);
      }
    });

    const aliceContacts = await contactsA.listContacts(sA);
    expect(aliceContacts).toHaveLength(1);
    expect(aliceContacts[0].identityId).toBe(docB.identityId);
  });
});
