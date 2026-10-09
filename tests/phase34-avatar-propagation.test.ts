/**
 * VEIL Phase 34: Avatar / Profile Picture Propagation Regression Tests
 *
 * Verifies:
 * 1. Contact and Invitation payloads preserve and propagate avatar data URL.
 * 2. ContactRequestManager preserves avatar across request sending, receiving, and accepting.
 * 3. Verified Contact records include avatar for UI display.
 */

import { describe, it, expect, vi } from 'vitest';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { sign } from '../src/identity/signing.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';

describe('Phase 34: Avatar Propagation', () => {
  it('preserves avatar in ContactManager from invitation payload', async () => {
    const storage = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storage);
    const vault = new SpaceVaultManager();
    const contactMgr = new ContactManager(store);

    const header = vault.createSpace({
      name: 'Alice',
      password: 'password123',
      kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 },
    });
    const session = vault.unlockSpace('password123', header.spaceId);

    const testAvatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';

    const contact = await contactMgr.addContactFromInvitation(session, {
      version: 1,
      identityId: 'id_bob_123',
      name: 'Bob',
      signingPublicKey: 'pk_sign_bob',
      keyAgreementPublicKey: 'pk_ka_bob',
      fingerprint: '12345678901234567890',
      avatar: testAvatar,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: 'sig_123',
    });

    expect(contact.avatar).toBe(testAvatar);

    const listed = await contactMgr.listContacts(session);
    expect(listed.length).toBe(1);
    expect(listed[0].avatar).toBe(testAvatar);
  });

  it('propagates avatar through ContactRequestManager accept handshake', async () => {
    const storage = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storage);
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const prekeyMgr = new PrekeyManager(store, idMgr);
    const contactMgr = new ContactManager(store);
    const sentEnvelopes = vi.fn().mockResolvedValue({ status: 'SENT_TO_RELAY' });
    const reqMgr = new ContactRequestManager(store, contactMgr, idMgr, { sendEnvelope: sentEnvelopes } as any);

    // Alice Space
    const headerAlice = vault.createSpace({
      name: 'Alice',
      password: 'password123',
      kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 },
    });
    const sessionAlice = vault.unlockSpace('password123', headerAlice.spaceId);
    idMgr.createIdentity(sessionAlice, store);
    const aliceLoaded = idMgr.loadIdentity(sessionAlice, store)!;
    prekeyMgr.generateSignedPrekey(sessionAlice);
    const aliceProfile = createSignedProfile(
      aliceLoaded.document.identityId,
      aliceLoaded.signingPrivateKey,
      'alice',
      'Alice Smith',
      'mbx_alice_1',
      prekeyMgr.createPrekeyBundle(sessionAlice)
    );

    // Bob Space
    const headerBob = vault.createSpace({
      name: 'Bob',
      password: 'password123',
      kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 },
    });
    const sessionBob = vault.unlockSpace('password123', headerBob.spaceId);
    idMgr.createIdentity(sessionBob, store);
    const bobLoaded = idMgr.loadIdentity(sessionBob, store)!;
    prekeyMgr.generateSignedPrekey(sessionBob);
    const bobPrekeyBundle = prekeyMgr.createPrekeyBundle(sessionBob);

    const bobAvatar = 'data:image/jpeg;base64,BOBAVATARDATA';
    const bobProfile = createSignedProfile(
      bobLoaded.document.identityId,
      bobLoaded.signingPrivateKey,
      'bob',
      'Bob Smith',
      'mbx_bob_1',
      bobPrekeyBundle,
      bobAvatar
    );

    const sentAt = Date.now();
    const reqSigBytes = sign(
      bobLoaded.signingPrivateKey,
      new TextEncoder().encode(
        JSON.stringify({
          requestId: 'req_001',
          senderIdentityId: bobLoaded.document.identityId,
          targetIdentityId: (idMgr.loadIdentity(sessionAlice, store))?.document.identityId,
          sentAt,
        })
      )
    );

    const forgedRequest = await reqMgr.handleInboundRequest(sessionAlice, {
      type: 'CONTACT_REQUEST',
      requestId: 'req_forged',
      senderProfile: bobProfile,
      sentAt,
      signature: bytesToBase64(new Uint8Array(64)),
    });
    expect(forgedRequest).toBeNull();
    expect(await reqMgr.listRequests(sessionAlice)).toEqual([]);

    // Inbound contact request from Bob into Alice's space
    const inbound = await reqMgr.handleInboundRequest(sessionAlice, {
      type: 'CONTACT_REQUEST',
      requestId: 'req_001',
      senderProfile: bobProfile,
      sentAt,
      signature: bytesToBase64(reqSigBytes),
    });

    expect(inbound).toBeDefined();

    const refreshedBobProfile = createSignedProfile(
      bobLoaded.document.identityId,
      bobLoaded.signingPrivateKey,
      'bob',
      'Bob Smith',
      'mbx_bob_current',
      bobPrekeyBundle,
      'data:image/jpeg;base64,BOBNEWAVATAR'
    );
    expect(await reqMgr.refreshPeerProfile(sessionAlice, bobLoaded.document.identityId, refreshedBobProfile)).toBe(true);

    // Alice accepts request (with optional profile)
    await reqMgr.acceptRequest(sessionAlice, 'req_001', aliceProfile);
    expect(sentEnvelopes).toHaveBeenCalledWith(
      sessionAlice,
      'mbx_bob_current',
      expect.stringContaining('CONTACT_RESPONSE'),
      undefined,
      { conversationId: bobLoaded.document.identityId }
    );

    // Verify Bob is added to Alice's contacts with his avatar
    const contacts = await contactMgr.listContacts(sessionAlice);
    const bobContact = contacts.find((c) => c.identityId === bobLoaded.document.identityId);
    expect(bobContact).toBeDefined();
    expect(bobContact?.avatar).toBe('data:image/jpeg;base64,BOBNEWAVATAR');
    expect(bobContact?.mailboxId).toBe('mbx_bob_current');
  });

  it('propagates responder avatar to sender when contact response is received', async () => {
    const storage = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storage);
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const prekeyMgr = new PrekeyManager(store, idMgr);
    const contactMgr = new ContactManager(store);
    const reqMgr = new ContactRequestManager(store, contactMgr, idMgr);

    // Alice Space
    const headerAlice = vault.createSpace({
      name: 'Alice',
      password: 'password123',
      kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 },
    });
    const sessionAlice = vault.unlockSpace('password123', headerAlice.spaceId);
    idMgr.createIdentity(sessionAlice, store);
    const aliceLoaded = idMgr.loadIdentity(sessionAlice, store)!;
    prekeyMgr.generateSignedPrekey(sessionAlice);
    const alicePrekeyBundle = prekeyMgr.createPrekeyBundle(sessionAlice);
    const aliceAvatar = 'data:image/png;base64,ALICEAVATARDATA';
    const aliceProfile = createSignedProfile(
      aliceLoaded.document.identityId,
      aliceLoaded.signingPrivateKey,
      'alice',
      'Alice Wonderland',
      'mbx_alice_1',
      alicePrekeyBundle,
      aliceAvatar
    );

    // Bob Space
    const headerBob = vault.createSpace({
      name: 'Bob',
      password: 'password123',
      kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 },
    });
    const sessionBob = vault.unlockSpace('password123', headerBob.spaceId);
    idMgr.createIdentity(sessionBob, store);
    const bobLoaded = idMgr.loadIdentity(sessionBob, store)!;
    prekeyMgr.generateSignedPrekey(sessionBob);
    const bobPrekeyBundle = prekeyMgr.createPrekeyBundle(sessionBob);
    const bobAvatar = 'data:image/jpeg;base64,BOBAVATARDATA';
    const bobProfile = createSignedProfile(
      bobLoaded.document.identityId,
      bobLoaded.signingPrivateKey,
      'bob',
      'Bob Smith',
      'mbx_bob_1',
      bobPrekeyBundle,
      bobAvatar
    );

    // 1. Bob initiates contact request to Alice
    const outgoingReq = await reqMgr.sendContactRequest(sessionBob, bobProfile, aliceProfile, 'Hi Alice!');
    expect(outgoingReq.status).toBe('OUTGOING_PENDING');

    // 2. Simulate Bob receiving Alice's accepted response wire payload
    const now = Date.now();
    const canonicalRes = JSON.stringify({
      requestId: outgoingReq.requestId,
      responderIdentityId: aliceProfile.identityId,
      status: 'ACCEPTED',
      respondedAt: now,
    });
    const sigBytes = sign(aliceLoaded.signingPrivateKey, new TextEncoder().encode(canonicalRes));

    const forgedResponse = await reqMgr.handleInboundResponse(sessionBob, {
      type: 'CONTACT_RESPONSE',
      requestId: outgoingReq.requestId,
      responderProfile: aliceProfile,
      status: 'ACCEPTED',
      respondedAt: now,
      signature: bytesToBase64(new Uint8Array(64)),
    });
    expect(forgedResponse).toBeNull();
    expect(await contactMgr.listContacts(sessionBob)).toEqual([]);

    await reqMgr.handleInboundResponse(sessionBob, {
      type: 'CONTACT_RESPONSE',
      requestId: outgoingReq.requestId,
      responderProfile: aliceProfile,
      status: 'ACCEPTED',
      respondedAt: now,
      signature: bytesToBase64(sigBytes),
    });

    // 3. Verify Alice is in Bob's contact list with her avatar
    const bobContacts = await contactMgr.listContacts(sessionBob);
    const aliceContact = bobContacts.find((c) => c.identityId === aliceLoaded.document.identityId);
    expect(aliceContact).toBeDefined();
    expect(aliceContact?.avatar).toBe(aliceAvatar);
  });

  it('rejects a contact response that reuses the peer identity id with a different signing key', async () => {
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const prekeyMgr = new PrekeyManager(store, idMgr);
    const contactMgr = new ContactManager(store);
    const reqMgr = new ContactRequestManager(store, contactMgr, idMgr);

    const aliceHeader = vault.createSpace({ name: 'Alice', password: 'password123', kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 } });
    const sessionAlice = vault.unlockSpace('password123', aliceHeader.spaceId);
    idMgr.createIdentity(sessionAlice, store);
    const alice = idMgr.loadIdentity(sessionAlice, store)!;
    prekeyMgr.generateSignedPrekey(sessionAlice);
    const aliceProfile = createSignedProfile(alice.document.identityId, alice.signingPrivateKey, 'alice', 'Alice', 'mbx_alice', prekeyMgr.createPrekeyBundle(sessionAlice));

    const bobHeader = vault.createSpace({ name: 'Bob', password: 'password123', kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 } });
    const sessionBob = vault.unlockSpace('password123', bobHeader.spaceId);
    idMgr.createIdentity(sessionBob, store);
    const bob = idMgr.loadIdentity(sessionBob, store)!;
    prekeyMgr.generateSignedPrekey(sessionBob);
    const bobProfile = createSignedProfile(bob.document.identityId, bob.signingPrivateKey, 'bob', 'Bob', 'mbx_bob', prekeyMgr.createPrekeyBundle(sessionBob));

    const request = await reqMgr.sendContactRequest(sessionBob, bobProfile, aliceProfile);
    const impostorProfile = createSignedProfile(
      alice.document.identityId,
      bob.signingPrivateKey,
      'alice',
      'Alice',
      'mbx_impostor',
      bobProfile.prekeyBundle
    );
    const respondedAt = Date.now();
    const responseSignature = sign(bob.signingPrivateKey, new TextEncoder().encode(JSON.stringify({
      requestId: request.requestId,
      responderIdentityId: alice.document.identityId,
      status: 'ACCEPTED',
      respondedAt,
    })));

    const result = await reqMgr.handleInboundResponse(sessionBob, {
      type: 'CONTACT_RESPONSE',
      requestId: request.requestId,
      responderProfile: impostorProfile,
      status: 'ACCEPTED',
      respondedAt,
      signature: bytesToBase64(responseSignature),
    });

    expect(result).toBeNull();
    expect((await reqMgr.getRequest(sessionBob, request.requestId))?.status).toBe('OUTGOING_PENDING');
    expect(await contactMgr.listContacts(sessionBob)).toEqual([]);
  });

  it('rejects legacy contact request signatures that do not bind the recipient and timestamp', async () => {
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const vault = new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const prekeyMgr = new PrekeyManager(store, idMgr);
    const contactMgr = new ContactManager(store);
    const reqMgr = new ContactRequestManager(store, contactMgr, idMgr);

    const aliceHeader = vault.createSpace({ name: 'Alice', password: 'password123', kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 } });
    const sessionAlice = vault.unlockSpace('password123', aliceHeader.spaceId);
    idMgr.createIdentity(sessionAlice, store);

    const bobHeader = vault.createSpace({ name: 'Bob', password: 'password123', kdfParams: { timeCost: 1, memoryCost: 1024, parallelism: 1 } });
    const sessionBob = vault.unlockSpace('password123', bobHeader.spaceId);
    idMgr.createIdentity(sessionBob, store);
    const bob = idMgr.loadIdentity(sessionBob, store)!;
    prekeyMgr.generateSignedPrekey(sessionBob);
    const bobProfile = createSignedProfile(bob.document.identityId, bob.signingPrivateKey, 'bob', 'Bob', 'mbx_bob', prekeyMgr.createPrekeyBundle(sessionBob));

    const sentAt = Date.now();
    const requestId = 'req_unbound_legacy';
    const weakSignature = sign(bob.signingPrivateKey, new TextEncoder().encode(JSON.stringify({
      requestId,
      senderIdentityId: bob.document.identityId,
    })));

    const result = await reqMgr.handleInboundRequest(sessionAlice, {
      type: 'CONTACT_REQUEST',
      requestId,
      senderProfile: bobProfile,
      sentAt,
      signature: bytesToBase64(weakSignature),
    });

    expect(result).toBeNull();
    expect(await reqMgr.listRequests(sessionAlice)).toEqual([]);
  });
});
