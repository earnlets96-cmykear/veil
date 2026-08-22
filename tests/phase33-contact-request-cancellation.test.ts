/**
 * Phase 33 Step 5: Contact Request Cancellation & State Machine Test Suite
 *
 * Verifies:
 * 1. Outgoing contact request creation & pending state.
 * 2. Outgoing contact request cancellation & local CANCELLED state.
 * 3. Cryptographic wire dispatch (ContactCancelWire) with valid Ed25519 signature.
 * 4. Inbound cancellation processing by recipient & transition to CANCELLED.
 * 5. Re-request capability after cancellation (NOT_CONNECTED relationship).
 * 6. Idempotent duplicate cancellation handling.
 * 7. Security: rejection of unsigned, forged, or unauthorized cancellation messages.
 * 8. Race condition: ACCEPTED request takes precedence over subsequent cancellation.
 * 9. Sensitive identifier non-disclosure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContactRequestManager, ContactCancelWire } from '../src/contacts/contactRequestManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { createSignedProfile, SignedProfileDocument } from '../src/identity/profile.ts';
import { getRelationshipState } from '../src/contacts/relationshipHelper.ts';
import { sign, verify } from '../src/identity/signing.ts';
import { base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';

describe('Phase 33 Step 5: Contact Request Polish & Outgoing Cancellation', () => {
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let contactMgr: ContactManager;
  let aliceManager: ContactRequestManager;
  let bobManager: ContactRequestManager;

  let aliceSession: SpaceSession;
  let bobSession: SpaceSession;
  let aliceProfile: SignedProfileDocument;
  let bobProfile: SignedProfileDocument;

  let lastDispatchedEnvelope: { mailboxId: string; payload: string } | null = null;

  beforeEach(async () => {
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    contactMgr = new ContactManager(store, idMgr);

    // Mock NetworkManager capturing outgoing envelopes
    const mockNetworkManager = {
      sendEnvelope: async (_session: SpaceSession, mailboxId: string, payload: string) => {
        lastDispatchedEnvelope = { mailboxId, payload };
      },
    } as any;

    aliceManager = new ContactRequestManager(store, contactMgr, idMgr, mockNetworkManager);
    bobManager = new ContactRequestManager(store, contactMgr, idMgr, mockNetworkManager);

    // 1. Create Alice Identity & Session
    aliceSession = new SpaceSession('space_alice', 'Alice Space', false, new Uint8Array(32).fill(1));
    const aliceDoc = idMgr.createIdentity(aliceSession, store);
    const aliceId = idMgr.loadIdentity(aliceSession, store)!;
    aliceProfile = await createSignedProfile(
      aliceDoc.identityId,
      aliceId.signingPrivateKey,
      'alice',
      'Alice Doe',
      'mailbox_alice_001',
      {
        identityDocument: aliceDoc,
        signedPrekey: { id: 1, publicKey: 'pk_alice_pre', signature: 'sig_alice_pre', createdAt: Date.now() },
      }
    );

    // 2. Create Bob Identity & Session
    bobSession = new SpaceSession('space_bob', 'Bob Space', false, new Uint8Array(32).fill(2));
    const bobDoc = idMgr.createIdentity(bobSession, store);
    const bobId = idMgr.loadIdentity(bobSession, store)!;
    bobProfile = await createSignedProfile(
      bobDoc.identityId,
      bobId.signingPrivateKey,
      'bob',
      'Bob Smith',
      'mailbox_bob_002',
      {
        identityDocument: bobDoc,
        signedPrekey: { id: 1, publicKey: 'pk_bob_pre', signature: 'sig_bob_pre', createdAt: Date.now() },
      }
    );

    lastDispatchedEnvelope = null;
  });

  it('sends an outgoing request, captures wire dispatch, and validates OUTGOING_PENDING state', async () => {
    const req = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile, 'Hello Bob!');

    expect(req.status).toBe('OUTGOING_PENDING');
    expect(req.peerIdentityId).toBe(bobProfile.identityId);
    expect(req.isIncoming).toBe(false);

    expect(lastDispatchedEnvelope).not.toBeNull();
    expect(lastDispatchedEnvelope?.mailboxId).toBe(bobProfile.mailboxId);

    const wire = JSON.parse(lastDispatchedEnvelope!.payload);
    expect(wire.type).toBe('CONTACT_REQUEST');
    expect(wire.requestId).toBe(req.requestId);
    expect(wire.greeting).toBe('Hello Bob!');
  });

  it('cancels outgoing request, dispatches ContactCancelWire, and updates local state to CANCELLED', async () => {
    const req = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    lastDispatchedEnvelope = null;

    const cancelledReq = await aliceManager.cancelRequest(aliceSession, req.requestId, aliceProfile);

    expect(cancelledReq.status).toBe('CANCELLED');

    // Verify stored state in EncryptedSpaceStore
    const stored = await aliceManager.getRequest(aliceSession, req.requestId);
    expect(stored?.status).toBe('CANCELLED');

    // Verify wire envelope dispatch
    expect(lastDispatchedEnvelope).not.toBeNull();
    expect(lastDispatchedEnvelope?.mailboxId).toBe(bobProfile.mailboxId);

    const cancelWire: ContactCancelWire = JSON.parse(lastDispatchedEnvelope!.payload);
    expect(cancelWire.type).toBe('CONTACT_CANCEL');
    expect(cancelWire.requestId).toBe(req.requestId);
    expect(cancelWire.senderIdentityId).toBe(aliceProfile.identityId);
    expect(cancelWire.signature).toBeDefined();

    // Verify Ed25519 signature on cancellation payload
    const pubKey = base64ToBytes(aliceProfile.prekeyBundle.identityDocument.signingPublicKey);
    const sig = base64ToBytes(cancelWire.signature);
    const canonicalCancel = JSON.stringify({
      requestId: cancelWire.requestId,
      senderIdentityId: aliceProfile.identityId,
      targetIdentityId: bobProfile.identityId,
      cancelledAt: cancelWire.cancelledAt,
    });
    const valid = verify(pubKey, new TextEncoder().encode(canonicalCancel), sig);
    expect(valid).toBe(true);
  });

  it('processes inbound cancellation on recipient side and transitions request to CANCELLED', async () => {
    // 1. Alice sends request to Bob
    const aliceReq = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    const reqWire = JSON.parse(lastDispatchedEnvelope!.payload);

    // 2. Bob receives inbound request
    const bobInbound = await bobManager.handleInboundRequest(bobSession, reqWire);
    expect(bobInbound?.status).toBe('INCOMING_PENDING');

    // 3. Alice cancels request
    await aliceManager.cancelRequest(aliceSession, aliceReq.requestId, aliceProfile);
    const cancelWire: ContactCancelWire = JSON.parse(lastDispatchedEnvelope!.payload);

    // 4. Bob receives inbound cancellation
    const bobCancelled = await bobManager.handleInboundCancel(bobSession, cancelWire);
    expect(bobCancelled?.status).toBe('CANCELLED');

    const bobStored = await bobManager.getRequest(bobSession, aliceReq.requestId);
    expect(bobStored?.status).toBe('CANCELLED');
  });

  it('enables clean re-requesting after cancellation with NOT_CONNECTED relationship state', async () => {
    // 1. Initial request & cancellation
    const req1 = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    await aliceManager.cancelRequest(aliceSession, req1.requestId, aliceProfile);

    const aliceRequests = await aliceManager.listRequests(aliceSession);
    const relState = getRelationshipState(bobProfile.identityId, bobProfile.username, {
      myIdentityId: aliceProfile.identityId,
      myUsername: aliceProfile.username,
      contacts: [],
      contactRequests: aliceRequests,
    });
    expect(relState).toBe('NOT_CONNECTED');

    // 2. Alice sends a NEW request with a new requestId
    const req2 = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile, 'Trying again!');
    expect(req2.status).toBe('OUTGOING_PENDING');
    expect(req2.requestId).not.toBe(req1.requestId);

    const updatedRequests = await aliceManager.listRequests(aliceSession);
    const updatedRelState = getRelationshipState(bobProfile.identityId, bobProfile.username, {
      myIdentityId: aliceProfile.identityId,
      myUsername: aliceProfile.username,
      contacts: [],
      contactRequests: updatedRequests,
    });
    expect(updatedRelState).toBe('PENDING_OUTGOING');
  });

  it('handles duplicate cancellation messages idempotently', async () => {
    const req = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    const reqWire = JSON.parse(lastDispatchedEnvelope!.payload);
    await bobManager.handleInboundRequest(bobSession, reqWire);

    await aliceManager.cancelRequest(aliceSession, req.requestId, aliceProfile);
    const cancelWire: ContactCancelWire = JSON.parse(lastDispatchedEnvelope!.payload);

    // First delivery
    const res1 = await bobManager.handleInboundCancel(bobSession, cancelWire);
    expect(res1?.status).toBe('CANCELLED');

    // Duplicate delivery
    const res2 = await bobManager.handleInboundCancel(bobSession, cancelWire);
    expect(res2?.status).toBe('CANCELLED');
  });

  it('rejects forged or tampered cancellation signatures', async () => {
    const req = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    const reqWire = JSON.parse(lastDispatchedEnvelope!.payload);
    await bobManager.handleInboundRequest(bobSession, reqWire);

    await aliceManager.cancelRequest(aliceSession, req.requestId, aliceProfile);
    const cancelWire: ContactCancelWire = JSON.parse(lastDispatchedEnvelope!.payload);

    // Tamper with signature
    cancelWire.signature = 'bad_sig_base64==';
    const res = await bobManager.handleInboundCancel(bobSession, cancelWire);
    expect(res).toBeNull();

    // Bob's request should remain INCOMING_PENDING
    const stored = await bobManager.getRequest(bobSession, req.requestId);
    expect(stored?.status).toBe('INCOMING_PENDING');
  });

  it('resolves accept-vs-cancel race condition: ACCEPTED request takes precedence', async () => {
    // 1. Alice sends request
    const aliceReq = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    const reqWire = JSON.parse(lastDispatchedEnvelope!.payload);
    await bobManager.handleInboundRequest(bobSession, reqWire);

    // 2. Bob ACCEPTS the request
    await bobManager.acceptRequest(bobSession, aliceReq.requestId, bobProfile);
    const bobAccepted = await bobManager.getRequest(bobSession, aliceReq.requestId);
    expect(bobAccepted?.status).toBe('ACCEPTED');

    // 3. Alice attempts cancellation or delayed cancellation arrives
    await aliceManager.cancelRequest(aliceSession, aliceReq.requestId, aliceProfile);
    const cancelWire: ContactCancelWire = JSON.parse(lastDispatchedEnvelope!.payload);

    // 4. Bob receives cancellation after acceptance
    const result = await bobManager.handleInboundCancel(bobSession, cancelWire);
    expect(result?.status).toBe('ACCEPTED');

    const bobFinal = await bobManager.getRequest(bobSession, aliceReq.requestId);
    expect(bobFinal?.status).toBe('ACCEPTED');

    // Bob's contact remains in address book
    const contact = await contactMgr.getContact(bobSession, aliceProfile.identityId);
    expect(contact?.status).toBe('ACCEPTED');
  });

  it('does not allow cancelling non-pending requests', async () => {
    const req = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    await aliceManager.cancelRequest(aliceSession, req.requestId, aliceProfile);

    // Attempting to cancel an already cancelled request throws
    await expect(aliceManager.cancelRequest(aliceSession, req.requestId, aliceProfile)).rejects.toThrow(
      'Cannot cancel contact request with status: CANCELLED'
    );
  });

  it('prevents blocked user from exploiting cancellation', async () => {
    const req = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    const reqWire = JSON.parse(lastDispatchedEnvelope!.payload);
    await bobManager.handleInboundRequest(bobSession, reqWire);

    // Bob blocks Alice
    await bobManager.blockUser(bobSession, aliceProfile.identityId);

    // Alice cancels
    await aliceManager.cancelRequest(aliceSession, req.requestId, aliceProfile);
    const cancelWire: ContactCancelWire = JSON.parse(lastDispatchedEnvelope!.payload);

    // Inbound cancel to a blocked user does not unblock or resurrect
    await bobManager.handleInboundCancel(bobSession, cancelWire);

    const isBlocked = await bobManager.isBlocked(bobSession, aliceProfile.identityId);
    expect(isBlocked).toBe(true);
  });

  it('audits ContactCancelWire for sensitive identifier non-disclosure', async () => {
    const req = await aliceManager.sendContactRequest(aliceSession, aliceProfile, bobProfile);
    await aliceManager.cancelRequest(aliceSession, req.requestId, aliceProfile);

    const rawPayload = lastDispatchedEnvelope!.payload;
    expect(rawPayload).not.toContain('sessionToken');
    expect(rawPayload).not.toContain('masterKey');
    expect(rawPayload).not.toContain('storageKey');
    expect(rawPayload).not.toContain('signingPrivateKey');
  });
});
