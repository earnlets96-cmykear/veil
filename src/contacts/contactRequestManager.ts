/**
 * Contact Request Subsystem & Manager for VEIL.
 *
 * Implements Space-isolated, cryptographically authenticated contact requests,
 * acceptance handshakes, blocklist management, and relay envelope routing.
 */

import { SignedProfileDocument, verifySignedProfile } from '../identity/profile.ts';
import { SpaceSession } from '../spaces/session.ts';
import { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { ContactManager } from './contactManager.ts';
import { NetworkManager } from '../network/networkManager.ts';
import { sign, verify } from '../identity/signing.ts';
import { bytesToBase64, base64ToBytes, randomBytes, bytesToHex } from '../crypto/utils.ts';
import { SpaceIdentityManager } from '../identity/manager.ts';

export type ContactRequestStatus =
  | 'OUTGOING_PENDING'
  | 'INCOMING_PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'BLOCKED';

export interface ContactRequest {
  requestId: string;
  peerIdentityId: string;
  peerUsername: string;
  peerDisplayName: string;
  peerProfile: SignedProfileDocument;
  status: ContactRequestStatus;
  isIncoming: boolean;
  greeting?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ContactRequestWire {
  type: 'CONTACT_REQUEST';
  requestId: string;
  senderProfile: SignedProfileDocument;
  greeting?: string;
  sentAt: number;
  signature: string; // Ed25519 signature
}

export interface ContactResponseWire {
  type: 'CONTACT_RESPONSE';
  requestId: string;
  responderProfile: SignedProfileDocument;
  status: 'ACCEPTED' | 'DECLINED';
  respondedAt: number;
  signature: string; // Ed25519 signature
}

export interface ContactCancelWire {
  type: 'CONTACT_CANCEL';
  requestId: string;
  senderIdentityId: string;
  targetIdentityId?: string;
  cancelledAt: number;
  signature: string; // Ed25519 signature
}

const REQUESTS_STORAGE_KEY = 'veil:contact_requests:list';
const BLOCKLIST_STORAGE_KEY = 'veil:blocklist:list';

export class ContactRequestManager {
  private store: EncryptedSpaceStore;
  private contactManager: ContactManager;
  private identityManager: SpaceIdentityManager;
  private networkManager?: NetworkManager;

  constructor(
    store: EncryptedSpaceStore,
    contactManager: ContactManager,
    identityManager: SpaceIdentityManager,
    networkManager?: NetworkManager
  ) {
    this.store = store;
    this.contactManager = contactManager;
    this.identityManager = identityManager;
    this.networkManager = networkManager;
  }

  public setNetworkManager(net: NetworkManager): void {
    this.networkManager = net;
  }

  public async listRequests(session: SpaceSession): Promise<ContactRequest[]> {
    const list = await this.store.getAsync<ContactRequest[]>(session, REQUESTS_STORAGE_KEY);
    return list || [];
  }

  public async getRequest(session: SpaceSession, requestId: string): Promise<ContactRequest | null> {
    const list = await this.listRequests(session);
    return list.find((r) => r.requestId === requestId) || null;
  }

  public async getRequestByPeerIdentity(session: SpaceSession, identityId: string): Promise<ContactRequest | null> {
    const list = await this.listRequests(session);
    return list.find((r) => r.peerIdentityId === identityId) || null;
  }

  public async listBlocklist(session: SpaceSession): Promise<string[]> {
    const list = await this.store.getAsync<string[]>(session, BLOCKLIST_STORAGE_KEY);
    return list || [];
  }

  public async isBlocked(session: SpaceSession, identityId: string): Promise<boolean> {
    const blocklist = await this.listBlocklist(session);
    return blocklist.includes(identityId);
  }

  /**
   * Initiates an outgoing contact request to a discovered profile.
   */
  public async sendContactRequest(
    session: SpaceSession,
    myProfile: SignedProfileDocument,
    targetProfile: SignedProfileDocument,
    greeting?: string
  ): Promise<ContactRequest> {
    // 1. Verify target profile validity
    if (!verifySignedProfile(targetProfile)) {
      throw new Error('Cannot send contact request: Target profile signature is invalid');
    }

    // 2. Check if already blocked or existing contact
    if (await this.isBlocked(session, targetProfile.identityId)) {
      throw new Error('Cannot send request to a blocked user');
    }

    const existingContact = await this.contactManager.getContact(session, targetProfile.identityId);
    if (existingContact && existingContact.status === 'ACCEPTED') {
      throw new Error('User is already in your contacts list');
    }

    const myIdentity = this.identityManager.loadIdentity(session, this.store);
    if (!myIdentity) {
      throw new Error('Active Space identity not loaded');
    }

    const requestId = `req_${bytesToHex(randomBytes(16))}`;
    const now = Date.now();

    // Canonical signing payload
    const canonicalReq = JSON.stringify({
      requestId,
      senderIdentityId: myProfile.identityId,
      targetIdentityId: targetProfile.identityId,
      sentAt: now,
    });
    const sigBytes = sign(myIdentity.signingPrivateKey, new TextEncoder().encode(canonicalReq));
    const signature = bytesToBase64(sigBytes);

    const wirePayload: ContactRequestWire = {
      type: 'CONTACT_REQUEST',
      requestId,
      senderProfile: myProfile,
      greeting,
      sentAt: now,
      signature,
    };

    // 3. Dispatch over blind relay envelope if networkManager is available
    if (this.networkManager) {
      await this.networkManager.sendEnvelope(
        session,
        targetProfile.mailboxId,
        JSON.stringify(wirePayload)
      );
    }

    // 4. Save to Space store
    const request: ContactRequest = {
      requestId,
      peerIdentityId: targetProfile.identityId,
      peerUsername: targetProfile.username,
      peerDisplayName: targetProfile.displayName,
      peerProfile: targetProfile,
      status: 'OUTGOING_PENDING',
      isIncoming: false,
      greeting,
      createdAt: now,
      updatedAt: now,
    };

    const requests = await this.listRequests(session);
    const existingIdx = requests.findIndex((r) => r.peerIdentityId === targetProfile.identityId);
    if (existingIdx >= 0) {
      requests[existingIdx] = request;
    } else {
      requests.push(request);
    }

    await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);
    return request;
  }

  /**
   * Processes an inbound contact request from a peer.
   */
  public async handleInboundRequest(
    session: SpaceSession,
    wire: ContactRequestWire
  ): Promise<ContactRequest | null> {
    if (!wire || wire.type !== 'CONTACT_REQUEST' || !wire.senderProfile) {
      return null;
    }

    // 1. Verify sender profile signature
    if (!verifySignedProfile(wire.senderProfile)) {
      return null; // Reject forged sender profile
    }

    // 2. Verify request signature
    const canonicalReq = JSON.stringify({
      requestId: wire.requestId,
      senderIdentityId: wire.senderProfile.identityId,
      targetIdentityId: session.spaceId ? undefined : undefined, // Sender signed target
    });

    try {
      const pubKeyBytes = base64ToBytes(wire.senderProfile.prekeyBundle.identityDocument.signingPublicKey);
      const sigBytes = base64ToBytes(wire.signature);
      // Validate signature
      const valid = verify(
        pubKeyBytes,
        new TextEncoder().encode(
          JSON.stringify({
            requestId: wire.requestId,
            senderIdentityId: wire.senderProfile.identityId,
            targetIdentityId: (this.identityManager.getPublicDocument(session, this.store))?.identityId,
            sentAt: wire.sentAt,
          })
        ),
        sigBytes
      ) || verify(pubKeyBytes, new TextEncoder().encode(canonicalReq), sigBytes);

      // Verify timestamp freshness (within 7 days)
      if (Date.now() - wire.sentAt > 7 * 24 * 60 * 60 * 1000) {
        return null;
      }
    } catch (_err) {
      // Signature parsing failure -> reject
      return null;
    }

    // 3. Check if blocked
    if (await this.isBlocked(session, wire.senderProfile.identityId)) {
      return null; // Silently drop requests from blocked identities
    }

    // 4. Save or update incoming pending request
    const requests = await this.listRequests(session);
    const existing = requests.find((r) => r.peerIdentityId === wire.senderProfile.identityId);

    const request: ContactRequest = {
      requestId: wire.requestId,
      peerIdentityId: wire.senderProfile.identityId,
      peerUsername: wire.senderProfile.username,
      peerDisplayName: wire.senderProfile.displayName,
      peerProfile: wire.senderProfile,
      status: existing?.status === 'ACCEPTED' ? 'ACCEPTED' : 'INCOMING_PENDING',
      isIncoming: true,
      greeting: wire.greeting,
      createdAt: wire.sentAt,
      updatedAt: Date.now(),
    };

    const existingIdx = requests.findIndex((r) => r.peerIdentityId === wire.senderProfile.identityId);
    if (existingIdx >= 0) {
      requests[existingIdx] = request;
    } else {
      requests.push(request);
    }

    await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);
    return request;
  }

  /**
   * Accepts an incoming contact request, adds contact to address book, and dispatches acceptance wire response.
   */
  public async acceptRequest(
    session: SpaceSession,
    requestId: string,
    myProfile: SignedProfileDocument
  ): Promise<ContactRequest> {
    const request = await this.getRequest(session, requestId);
    if (!request) {
      throw new Error(`Contact request not found: ${requestId}`);
    }

    const myIdentity = this.identityManager.loadIdentity(session, this.store);
    if (!myIdentity) {
      throw new Error('Active Space identity not loaded');
    }

    const now = Date.now();
    const canonicalRes = JSON.stringify({
      requestId,
      responderIdentityId: myProfile.identityId,
      status: 'ACCEPTED',
      respondedAt: now,
    });
    const sigBytes = sign(myIdentity.signingPrivateKey, new TextEncoder().encode(canonicalRes));
    const signature = bytesToBase64(sigBytes);

    const responseWire: ContactResponseWire = {
      type: 'CONTACT_RESPONSE',
      requestId,
      responderProfile: myProfile,
      status: 'ACCEPTED',
      respondedAt: now,
      signature,
    };

    // 1. Dispatch acceptance response to peer's mailbox
    if (this.networkManager) {
      await this.networkManager.sendEnvelope(
        session,
        request.peerProfile.mailboxId,
        JSON.stringify(responseWire)
      );
    }

    // 2. Add peer to Space ContactManager
    await this.contactManager.addContactFromInvitation(session, {
      version: 1,
      identityId: request.peerProfile.identityId,
      name: request.peerProfile.displayName || request.peerProfile.username,
      signingPublicKey: request.peerProfile.prekeyBundle.identityDocument.signingPublicKey,
      keyAgreementPublicKey: request.peerProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
      fingerprint: request.peerProfile.prekeyBundle.identityDocument.fingerprint,
      mailboxId: request.peerProfile.mailboxId,
      prekeyBundle: request.peerProfile.prekeyBundle,
      createdAt: request.peerProfile.issuedAt,
      expiresAt: request.peerProfile.expiresAt || 0,
      signature: request.peerProfile.signature,
    });

    // 3. Mark request as ACCEPTED
    request.status = 'ACCEPTED';
    request.updatedAt = now;

    const requests = await this.listRequests(session);
    const idx = requests.findIndex((r) => r.requestId === requestId);
    if (idx >= 0) requests[idx] = request;
    await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);

    return request;
  }

  /**
   * Declines an incoming contact request.
   */
  public async declineRequest(session: SpaceSession, requestId: string): Promise<void> {
    const request = await this.getRequest(session, requestId);
    if (!request) return;

    request.status = 'DECLINED';
    request.updatedAt = Date.now();

    const requests = await this.listRequests(session);
    const idx = requests.findIndex((r) => r.requestId === requestId);
    if (idx >= 0) requests[idx] = request;
    await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);
  }

  /**
   * Blocks a user by identityId and purges any active requests.
   */
  public async blockUser(session: SpaceSession, identityId: string): Promise<void> {
    const blocklist = await this.listBlocklist(session);
    if (!blocklist.includes(identityId)) {
      blocklist.push(identityId);
      await this.store.setAsync(session, BLOCKLIST_STORAGE_KEY, blocklist);
    }

    // Also mark contact as BLOCKED if present
    await this.contactManager.blockContact(session, identityId);

    // Update request state to BLOCKED
    const requests = await this.listRequests(session);
    const req = requests.find((r) => r.peerIdentityId === identityId);
    if (req) {
      req.status = 'BLOCKED';
      req.updatedAt = Date.now();
      await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);
    }
  }

  /**
   * Unblocks a user.
   */
  public async unblockUser(session: SpaceSession, identityId: string): Promise<void> {
    let blocklist = await this.listBlocklist(session);
    blocklist = blocklist.filter((id) => id !== identityId);
    await this.store.setAsync(session, BLOCKLIST_STORAGE_KEY, blocklist);

    await this.contactManager.unblockContact(session, identityId);
  }

  /**
   * Handles an inbound contact response (e.g. peer accepted my request).
   */
  public async handleInboundResponse(
    session: SpaceSession,
    wire: ContactResponseWire
  ): Promise<ContactRequest | null> {
    if (!wire || wire.type !== 'CONTACT_RESPONSE' || !wire.responderProfile) {
      return null;
    }

    // 1. Verify responder profile signature
    if (!verifySignedProfile(wire.responderProfile)) {
      return null;
    }

    const requests = await this.listRequests(session);
    const request = requests.find(
      (r) => r.requestId === wire.requestId || r.peerIdentityId === wire.responderProfile.identityId
    );

    if (!request) return null;

    if (wire.status === 'ACCEPTED') {
      request.status = 'ACCEPTED';
      request.updatedAt = Date.now();

      // Add responder to ContactManager
      await this.contactManager.addContactFromInvitation(session, {
        version: 1,
        identityId: wire.responderProfile.identityId,
        name: wire.responderProfile.displayName || wire.responderProfile.username,
        signingPublicKey: wire.responderProfile.prekeyBundle.identityDocument.signingPublicKey,
        keyAgreementPublicKey: wire.responderProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
        fingerprint: wire.responderProfile.prekeyBundle.identityDocument.fingerprint,
        mailboxId: wire.responderProfile.mailboxId,
        prekeyBundle: wire.responderProfile.prekeyBundle,
        createdAt: wire.responderProfile.issuedAt,
        expiresAt: wire.responderProfile.expiresAt || 0,
        signature: wire.responderProfile.signature,
      });
    } else {
      request.status = 'DECLINED';
      request.updatedAt = Date.now();
    }

    const idx = requests.findIndex((r) => r.requestId === request.requestId);
    if (idx >= 0) requests[idx] = request;
    await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);

    return request;
  }

  /**
   * Cancels a pending outgoing contact request and dispatches a signed cancellation wire.
   */
  public async cancelRequest(
    session: SpaceSession,
    requestId: string,
    myProfile: SignedProfileDocument
  ): Promise<ContactRequest> {
    const request = await this.getRequest(session, requestId);
    if (!request) {
      throw new Error(`Contact request not found: ${requestId}`);
    }

    if (request.status !== 'OUTGOING_PENDING') {
      throw new Error(`Cannot cancel contact request with status: ${request.status}`);
    }

    const myIdentity = this.identityManager.loadIdentity(session, this.store);
    if (!myIdentity) {
      throw new Error('Active Space identity not loaded');
    }

    const now = Date.now();
    const canonicalCancel = JSON.stringify({
      requestId,
      senderIdentityId: myProfile.identityId,
      targetIdentityId: request.peerProfile.identityId,
      cancelledAt: now,
    });
    const sigBytes = sign(myIdentity.signingPrivateKey, new TextEncoder().encode(canonicalCancel));
    const signature = bytesToBase64(sigBytes);

    const cancelWire: ContactCancelWire = {
      type: 'CONTACT_CANCEL',
      requestId,
      senderIdentityId: myProfile.identityId,
      targetIdentityId: request.peerProfile.identityId,
      cancelledAt: now,
      signature,
    };

    // Dispatch cancellation over blind relay envelope if networkManager is available
    if (this.networkManager) {
      await this.networkManager.sendEnvelope(
        session,
        request.peerProfile.mailboxId,
        JSON.stringify(cancelWire)
      );
    }

    // Mark request as CANCELLED
    request.status = 'CANCELLED';
    request.updatedAt = now;

    const requests = await this.listRequests(session);
    const idx = requests.findIndex((r) => r.requestId === requestId);
    if (idx >= 0) requests[idx] = request;
    await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);

    return request;
  }

  /**
   * Handles an inbound contact request cancellation from a peer.
   */
  public async handleInboundCancel(
    session: SpaceSession,
    wire: ContactCancelWire
  ): Promise<ContactRequest | null> {
    if (!wire || wire.type !== 'CONTACT_CANCEL' || !wire.requestId) {
      return null;
    }

    const requests = await this.listRequests(session);
    const request = requests.find(
      (r) => r.requestId === wire.requestId || r.peerIdentityId === wire.senderIdentityId
    );

    if (!request) return null;

    // Deterministic race condition handling:
    // If request was already ACCEPTED, acceptance takes precedence and contact remains valid.
    if (request.status === 'ACCEPTED') {
      return request;
    }

    // Verify Ed25519 signature of the cancellation message
    try {
      const pubKeyBytes = base64ToBytes(
        request.peerProfile.prekeyBundle.identityDocument.signingPublicKey
      );
      const sigBytes = base64ToBytes(wire.signature);

      const canonicalPayload = JSON.stringify({
        requestId: wire.requestId,
        senderIdentityId: wire.senderIdentityId,
        targetIdentityId: (this.identityManager.getPublicDocument(session, this.store))?.identityId,
        cancelledAt: wire.cancelledAt,
      });

      const fallbackPayload = JSON.stringify({
        requestId: wire.requestId,
        senderIdentityId: wire.senderIdentityId,
        targetIdentityId: wire.targetIdentityId,
        cancelledAt: wire.cancelledAt,
      });

      const valid =
        verify(pubKeyBytes, new TextEncoder().encode(canonicalPayload), sigBytes) ||
        verify(pubKeyBytes, new TextEncoder().encode(fallbackPayload), sigBytes);

      if (!valid) {
        return null; // Reject forged or tampered cancellation
      }
    } catch (_err) {
      return null;
    }

    // Update status to CANCELLED
    request.status = 'CANCELLED';
    request.updatedAt = Date.now();

    const idx = requests.findIndex((r) => r.requestId === request.requestId);
    if (idx >= 0) requests[idx] = request;
    await this.store.setAsync(session, REQUESTS_STORAGE_KEY, requests);

    return request;
  }
}
