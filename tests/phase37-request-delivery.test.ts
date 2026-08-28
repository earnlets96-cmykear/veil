/**
 * Phase 37 — Contact / Account Request Delivery & Relationship State Test Suite
 *
 * Verifies:
 * 1. Contact request outbound dispatch, relay transfer, and inbound delivery.
 * 2. Pending request filter returns incoming requests accurately.
 * 3. Acceptance establishes mutual end-to-end encrypted contact relationship.
 * 4. getRelationshipState accurately reflects lifecycle states without undefined errors.
 */

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
import { getRelationshipState } from '../src/contacts/relationshipHelper.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 37 — Request Delivery & Relationship Verification', () => {
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

  it('3.1: Outbound contact request created and detected by inbound filter', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // 1. Setup Alice
    const vault1 = new SpaceVaultManager();
    const s1 = vault1.unlockSpace('P1!', vault1.createSpace({ name: 'Alice Space', password: 'P1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
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
    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'alice', 'Alice A', mb1.mailboxId, bundle1);

    // 2. Setup Bob
    const vault2 = new SpaceVaultManager();
    const s2 = vault2.unlockSpace('P2!', vault2.createSpace({ name: 'Bob Space', password: 'P2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
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
    const profile2 = createSignedProfile(doc2.identityId, id2.signingPrivateKey, 'bob', 'Bob B', mb2.mailboxId, bundle2);

    // Initial relationship states
    const aliceToBobInitial = getRelationshipState(doc2.identityId, 'bob', {
      myIdentityId: doc1.identityId,
      myUsername: 'alice',
      contacts: [],
      contactRequests: [],
    });
    expect(aliceToBobInitial).toBe('NOT_CONNECTED');

    // 3. Alice sends contact request to Bob
    const outgoingReq = await reqMgr1.sendContactRequest(s1, profile1, profile2, 'Hi Bob, let us connect!');
    expect(outgoingReq.isIncoming).toBe(false);
    expect(outgoingReq.status).toBe('OUTGOING_PENDING');

    const aliceRequests = await reqMgr1.listRequests(s1);
    const alicePendingOutgoing = aliceRequests.filter((r) => !r.isIncoming && r.status === 'OUTGOING_PENDING');
    expect(alicePendingOutgoing.length).toBe(1);

    // Alice relationship to Bob is now PENDING_OUTGOING
    const aliceToBobPending = getRelationshipState(doc2.identityId, 'bob', {
      myIdentityId: doc1.identityId,
      myUsername: 'alice',
      contacts: [],
      contactRequests: aliceRequests,
    });
    expect(aliceToBobPending).toBe('PENDING_OUTGOING');

    // 4. Bob syncs mailbox and processes inbound request
    await net2.syncMailbox(s2, async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_REQUEST') {
        await reqMgr2.handleInboundRequest(s2, parsed);
      }
    });

    const bobRequests = await reqMgr2.listRequests(s2);
    const bobPendingIncoming = bobRequests.filter((r) => r.isIncoming && r.status === 'INCOMING_PENDING');
    expect(bobPendingIncoming.length).toBe(1);
    expect(bobPendingIncoming[0].peerUsername).toBe('alice');

    // Bob relationship to Alice is now PENDING_INCOMING
    const bobToAlicePending = getRelationshipState(doc1.identityId, 'alice', {
      myIdentityId: doc2.identityId,
      myUsername: 'bob',
      contacts: [],
      contactRequests: bobRequests,
    });
    expect(bobToAlicePending).toBe('PENDING_INCOMING');

    // 5. Bob accepts contact request
    await reqMgr2.acceptRequest(s2, bobPendingIncoming[0].requestId, profile2);

    const bobContacts = await contacts2.listContacts(s2);
    expect(bobContacts.length).toBe(1);
    expect(bobContacts[0].identityId).toBe(doc1.identityId);

    const bobToAliceAccepted = getRelationshipState(doc1.identityId, 'alice', {
      myIdentityId: doc2.identityId,
      myUsername: 'bob',
      contacts: bobContacts,
      contactRequests: await reqMgr2.listRequests(s2),
    });
    expect(bobToAliceAccepted).toBe('CONTACT_UNVERIFIED');

    // Bob verifies safety number
    await contacts2.updateVerification(s2, doc1.identityId, 'VERIFIED');
    const bobVerifiedContacts = await contacts2.listContacts(s2);
    const bobToAliceVerified = getRelationshipState(doc1.identityId, 'alice', {
      myIdentityId: doc2.identityId,
      myUsername: 'bob',
      contacts: bobVerifiedContacts,
      contactRequests: await reqMgr2.listRequests(s2),
    });
    expect(bobToAliceVerified).toBe('CONTACT_VERIFIED');
  });
});
