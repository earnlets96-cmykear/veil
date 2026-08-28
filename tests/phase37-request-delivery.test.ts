/**
 * Phase 37 Request Delivery Regression Tests.
 *
 * Validates the contact request dispatch pipeline: Ed25519 signed request creation,
 * relay envelope routing to correct mailbox, persistence in encrypted store, and
 * blocklist enforcement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { verify } from '../src/identity/signing.ts';
import { base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { createSignedProfile, verifySignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

function createFullIdentity(name: string, password: string) {
  const vault = new SpaceVaultManager();
  const header = vault.createSpace({ name, password, kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace(password, header.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const idMgr = new SpaceIdentityManager();
  const doc = idMgr.createIdentity(session, store);
  const identity = idMgr.loadIdentity(session, store)!;
  const prekeyMgr = new PrekeyManager(store, idMgr);
  prekeyMgr.generateSignedPrekey(session);
  prekeyMgr.generateOneTimePrekeys(session, 5);
  const bundle = prekeyMgr.createPrekeyBundle(session);
  return { vault, session, store, idMgr, doc, identity, prekeyMgr, bundle };
}

describe('Phase 37 — Contact Request Delivery Pipeline', () => {
  it('sends a contact request with valid Ed25519 signature and correct wire format', async () => {
    const alice = createFullIdentity('AliceSpace', 'Pass!');
    const bob = createFullIdentity('BobSpace', 'Pass!');

    const aliceProfile = createSignedProfile(
      alice.doc.identityId,
      alice.identity.signingPrivateKey,
      'alice_sender',
      'Alice',
      'mailbox_alice_001',
      alice.bundle
    );
    const bobProfile = createSignedProfile(
      bob.doc.identityId,
      bob.identity.signingPrivateKey,
      'bob_target',
      'Bob',
      'mailbox_bob_001',
      bob.bundle
    );

    const contactManager = new ContactManager(alice.store);
    const requestManager = new ContactRequestManager(alice.store, contactManager, alice.idMgr);

    // Mock NetworkManager
    let capturedPayload: string | null = null;
    let capturedMailbox: string | null = null;
    const mockNetManager = {
      sendEnvelope: vi.fn(async (_session: any, mailboxId: string, payload: string) => {
        capturedMailbox = mailboxId;
        capturedPayload = payload;
        return {} as any;
      }),
    };
    requestManager.setNetworkManager(mockNetManager as any);

    const result = await requestManager.sendContactRequest(
      alice.session,
      aliceProfile,
      bobProfile,
      'Hello Bob!'
    );

    // Verify result structure
    expect(result.requestId).toBeTruthy();
    expect(result.peerIdentityId).toBe(bob.doc.identityId);
    expect(result.peerUsername).toBe('bob_target');
    expect(result.status).toBe('OUTGOING_PENDING');
    expect(result.isIncoming).toBe(false);
    expect(result.greeting).toBe('Hello Bob!');

    // Verify wire payload was sent to Bob's mailbox
    expect(capturedMailbox).toBe('mailbox_bob_001');
    expect(capturedPayload).toBeTruthy();

    // Verify wire payload structure
    const wire = JSON.parse(capturedPayload!);
    expect(wire.type).toBe('CONTACT_REQUEST');
    expect(wire.requestId).toBe(result.requestId);
    expect(wire.senderProfile.identityId).toBe(alice.doc.identityId);
    expect(wire.senderProfile.username).toBe('alice_sender');
    expect(wire.greeting).toBe('Hello Bob!');
    expect(wire.signature).toBeTruthy();

    // Verify Ed25519 signature is valid
    const canonicalPayload = JSON.stringify({
      requestId: result.requestId,
      senderIdentityId: alice.doc.identityId,
      targetIdentityId: bob.doc.identityId,
      sentAt: wire.sentAt,
    });
    const sigValid = verify(
      base64ToBytes(alice.identity.document.signingPublicKey),
      new TextEncoder().encode(canonicalPayload),
      base64ToBytes(wire.signature)
    );
    expect(sigValid).toBe(true);
  });

  it('persists request in encrypted store and allows listing', async () => {
    const alice = createFullIdentity('AliceSpace2', 'Pass!');
    const bob = createFullIdentity('BobSpace2', 'Pass!');

    const aliceProfile = createSignedProfile(
      alice.doc.identityId,
      alice.identity.signingPrivateKey,
      'carol_persist',
      'Carol',
      'mailbox_carol',
      alice.bundle
    );
    const bobProfile = createSignedProfile(
      bob.doc.identityId,
      bob.identity.signingPrivateKey,
      'dave_persist',
      'Dave',
      'mailbox_dave',
      bob.bundle
    );

    const contactManager = new ContactManager(alice.store);
    const requestManager = new ContactRequestManager(alice.store, contactManager, alice.idMgr);

    await requestManager.sendContactRequest(alice.session, aliceProfile, bobProfile);

    // List requests and verify persistence
    const requests = await requestManager.listRequests(alice.session);
    expect(requests.length).toBeGreaterThanOrEqual(1);
    const found = requests.find((r) => r.peerIdentityId === bob.doc.identityId);
    expect(found).toBeTruthy();
    expect(found!.peerUsername).toBe('dave_persist');
    expect(found!.status).toBe('OUTGOING_PENDING');
  });

  it('rejects sending request to a blocked user', async () => {
    const alice = createFullIdentity('AliceSpace3', 'Pass!');
    const bob = createFullIdentity('BobSpace3', 'Pass!');

    const aliceProfile = createSignedProfile(
      alice.doc.identityId,
      alice.identity.signingPrivateKey,
      'blocker_user',
      'Blocker',
      'mailbox_blocker',
      alice.bundle
    );
    const bobProfile = createSignedProfile(
      bob.doc.identityId,
      bob.identity.signingPrivateKey,
      'badperson_user',
      'BadPerson',
      'mailbox_bad',
      bob.bundle
    );

    const contactManager = new ContactManager(alice.store);
    const requestManager = new ContactRequestManager(alice.store, contactManager, alice.idMgr);

    // Block the user first
    await requestManager.blockUser(alice.session, bob.doc.identityId);

    // Attempt to send request should fail
    await expect(
      requestManager.sendContactRequest(alice.session, aliceProfile, bobProfile)
    ).rejects.toThrow(/blocked/i);
  });
});
