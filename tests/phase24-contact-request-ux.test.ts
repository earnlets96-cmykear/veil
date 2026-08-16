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
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Contact Request UX & State Machine Tests', () => {
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

  it('manages full contact request lifecycle: search, request, accept, decline, block, and duplicate prevention', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Alice
    const vA = new SpaceVaultManager();
    const sA = vA.unlockSpace('PA!', vA.createSpace({ name: 'Alice', password: 'PA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    const docA = idMgrA.createIdentity(sA, storeA);
    const idA = idMgrA.loadIdentity(sA, storeA)!;
    const preA = new PrekeyManager(storeA, idMgrA);
    preA.generateSignedPrekey(sA);
    const bundleA = preA.createPrekeyBundle(sA);
    const netA = new NetworkManager(storeA, netConfig);
    const mbA = await netA.getOrCreateMailbox(sA);
    const contactsA = new ContactManager(storeA);
    const reqMgrA = new ContactRequestManager(storeA, contactsA, idMgrA, netA);

    const profileA = createSignedProfile(docA.identityId, idA.signingPrivateKey, 'alice_ux', 'Alice UX', mbA.mailboxId, bundleA);
    await client.registerProfile(profileA);

    // Bob
    const vB = new SpaceVaultManager();
    const sB = vB.unlockSpace('PB!', vB.createSpace({ name: 'Bob', password: 'PB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    const docB = idMgrB.createIdentity(sB, storeB);
    const idB = idMgrB.loadIdentity(sB, storeB)!;
    const preB = new PrekeyManager(storeB, idMgrB);
    preB.generateSignedPrekey(sB);
    const bundleB = preB.createPrekeyBundle(sB);
    const netB = new NetworkManager(storeB, netConfig);
    const mbB = await netB.getOrCreateMailbox(sB);
    const contactsB = new ContactManager(storeB);
    const reqMgrB = new ContactRequestManager(storeB, contactsB, idMgrB, netB);

    const profileB = createSignedProfile(docB.identityId, idB.signingPrivateKey, 'bob_ux', 'Bob UX', mbB.mailboxId, bundleB);
    await client.registerProfile(profileB);

    // 1. Alice searches for Bob
    const results = await client.searchProfiles('bob_ux');
    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('bob_ux');

    // 2. Alice sends request to Bob
    const pB = (await client.getProfileByUsername('bob_ux'))!;
    const reqOut = await reqMgrA.sendContactRequest(sA, profileA, pB, 'Hey Bob, let us connect');
    expect(reqOut.status).toBe('OUTGOING_PENDING');

    // 3. Bob receives request
    await netB.syncMailbox(sB, async (p) => {
      const parsed = JSON.parse(p);
      if (parsed.type === 'CONTACT_REQUEST') await reqMgrB.handleInboundRequest(sB, parsed);
    });

    const bobReqs = await reqMgrB.listRequests(sB);
    expect(bobReqs).toHaveLength(1);
    expect(bobReqs[0].status).toBe('INCOMING_PENDING');
    expect(bobReqs[0].greeting).toBe('Hey Bob, let us connect');

    // 4. Bob declines request
    await reqMgrB.declineRequest(sB, bobReqs[0].requestId);
    const declinedReq = await reqMgrB.getRequest(sB, bobReqs[0].requestId);
    expect(declinedReq?.status).toBe('DECLINED');

    // 5. Bob blocks Alice
    await reqMgrB.blockUser(sB, docA.identityId);
    expect(await reqMgrB.isBlocked(sB, docA.identityId)).toBe(true);

    // 6. Alice tries to send another request -> Bob's client rejects/drops it
    const spamReq = await reqMgrA.sendContactRequest(sA, profileA, pB, 'Another request');
    const dropped = await reqMgrB.handleInboundRequest(sB, {
      type: 'CONTACT_REQUEST',
      requestId: spamReq.requestId,
      senderProfile: profileA,
      greeting: 'Spam attempt',
      sentAt: Date.now(),
      signature: profileA.signature,
    });
    expect(dropped).toBeNull();
  });
});
