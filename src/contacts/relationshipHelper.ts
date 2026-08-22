/**
 * Relationship State Helper for VEIL.
 *
 * Computes the relationship between the active local identity and a target peer:
 * - SELF: Current user's own identity
 * - BLOCKED: User is in Space blocklist or blocked contact
 * - CONTACT_VERIFIED: Added contact with verified cryptographic safety number
 * - CONTACT_UNVERIFIED: Added contact with unverified safety number
 * - KEY_CHANGED: Contact whose cryptographic identity key changed unexpectedly
 * - PENDING_INCOMING: Peer sent a contact request to local user
 * - PENDING_OUTGOING: Local user sent a contact request to peer
 * - NOT_CONNECTED: No established relationship or pending request
 */

import { Contact } from './types.ts';
import { ContactRequest } from './contactRequestManager.ts';

export type RelationshipState =
  | 'SELF'
  | 'BLOCKED'
  | 'CONTACT_VERIFIED'
  | 'CONTACT_UNVERIFIED'
  | 'KEY_CHANGED'
  | 'PENDING_INCOMING'
  | 'PENDING_OUTGOING'
  | 'NOT_CONNECTED';

export interface RelationshipContext {
  myIdentityId?: string;
  myUsername?: string;
  contacts: Contact[];
  contactRequests: ContactRequest[];
  blocklist?: string[];
}

export function getRelationshipState(
  peerIdentityId: string | undefined,
  peerUsername: string | undefined,
  ctx: RelationshipContext
): RelationshipState {
  const cleanPeerUsername = peerUsername ? peerUsername.toLowerCase().replace(/^@/, '') : undefined;
  const cleanMyUsername = ctx.myUsername ? ctx.myUsername.toLowerCase().replace(/^@/, '') : undefined;

  // 1. Check if self
  if (
    (peerIdentityId && ctx.myIdentityId && peerIdentityId === ctx.myIdentityId) ||
    (cleanPeerUsername && cleanMyUsername && cleanPeerUsername === cleanMyUsername)
  ) {
    return 'SELF';
  }

  // 2. Check blocklist
  if (peerIdentityId && ctx.blocklist && ctx.blocklist.includes(peerIdentityId)) {
    return 'BLOCKED';
  }

  // 3. Check contacts list
  const matchedContact = ctx.contacts.find(
    (c) =>
      (peerIdentityId && c.identityId === peerIdentityId) ||
      (cleanPeerUsername && c.name.toLowerCase().replace(/^@/, '') === cleanPeerUsername)
  );

  if (matchedContact) {
    if (matchedContact.status === 'BLOCKED') {
      return 'BLOCKED';
    }
    if (matchedContact.verificationStatus === 'FAILED') {
      return 'KEY_CHANGED';
    }
    if (matchedContact.verificationStatus === 'VERIFIED') {
      return 'CONTACT_VERIFIED';
    }
    return 'CONTACT_UNVERIFIED';
  }

  // 4. Check contact requests (prioritize active pending requests)
  const activeRequests = ctx.contactRequests.filter(
    (r) =>
      (peerIdentityId && r.peerIdentityId === peerIdentityId) ||
      (cleanPeerUsername && r.peerUsername.toLowerCase().replace(/^@/, '') === cleanPeerUsername)
  );

  const pendingReq = activeRequests.find((r) => r.status === 'INCOMING_PENDING' || r.status === 'OUTGOING_PENDING');
  if (pendingReq) {
    if (pendingReq.status === 'INCOMING_PENDING') return 'PENDING_INCOMING';
    if (pendingReq.status === 'OUTGOING_PENDING') return 'PENDING_OUTGOING';
  }

  const otherReq = activeRequests.find((r) => r.status === 'BLOCKED' || r.status === 'ACCEPTED');
  if (otherReq) {
    if (otherReq.status === 'BLOCKED') return 'BLOCKED';
    if (otherReq.status === 'ACCEPTED') return 'CONTACT_UNVERIFIED';
  }

  return 'NOT_CONNECTED';
}
