/**
 * Relationship State Helper for VEIL.
 *
 * Computes the relationship between the active local identity and a target peer:
 * - SELF: Current user's own identity
 * - BLOCKED: User is in Space blocklist or blocked contact
 * - CONTACT_VERIFIED: Added contact with verified cryptographic safety number
 * - CONTACT_UNVERIFIED: Added contact with unverified safety number
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
    if (matchedContact.verificationStatus === 'VERIFIED') {
      return 'CONTACT_VERIFIED';
    }
    return 'CONTACT_UNVERIFIED';
  }

  // 4. Check pending contact requests
  const matchedRequest = ctx.contactRequests.find(
    (r) =>
      (peerIdentityId && r.peerIdentityId === peerIdentityId) ||
      (cleanPeerUsername && r.peerUsername.toLowerCase().replace(/^@/, '') === cleanPeerUsername)
  );

  if (matchedRequest) {
    if (matchedRequest.status === 'INCOMING_PENDING') {
      return 'PENDING_INCOMING';
    }
    if (matchedRequest.status === 'OUTGOING_PENDING') {
      return 'PENDING_OUTGOING';
    }
    if (matchedRequest.status === 'BLOCKED') {
      return 'BLOCKED';
    }
    if (matchedRequest.status === 'ACCEPTED') {
      return 'CONTACT_UNVERIFIED';
    }
  }

  return 'NOT_CONNECTED';
}
