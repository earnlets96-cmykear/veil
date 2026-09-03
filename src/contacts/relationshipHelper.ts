/**
 * Relationship State Helper for VEIL.
 *
 * Computes the relationship between the active local identity and a target peer:
 * - SELF: Current user's own identity (same identityId or same username)
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
  contacts?: Contact[];
  contactRequests?: ContactRequest[];
  blocklist?: string[];
}

export function getRelationshipState(
  peerIdentityId: string | undefined,
  peerUsername: string | undefined,
  ctxOrContacts: RelationshipContext | Contact[] = {},
  maybeRequests: ContactRequest[] = []
): RelationshipState {
  // Normalize parameters to support both context object and positional array arguments
  let ctx: RelationshipContext;
  if (Array.isArray(ctxOrContacts)) {
    ctx = {
      contacts: ctxOrContacts,
      contactRequests: maybeRequests,
    };
  } else {
    ctx = ctxOrContacts || {};
  }

  const contactsList = Array.isArray(ctx.contacts) ? ctx.contacts : [];
  const requestsList = Array.isArray(ctx.contactRequests) ? ctx.contactRequests : [];
  const blocklist = Array.isArray(ctx.blocklist) ? ctx.blocklist : [];

  const cleanPeerUsername = peerUsername ? peerUsername.toLowerCase().replace(/^@/, '').trim() : undefined;
  const cleanMyUsername = ctx.myUsername ? ctx.myUsername.toLowerCase().replace(/^@/, '').trim() : undefined;

  // 1. Check if self (same identityId or same username)
  if (
    (peerIdentityId && ctx.myIdentityId && peerIdentityId === ctx.myIdentityId) ||
    (cleanPeerUsername && cleanMyUsername && cleanPeerUsername === cleanMyUsername)
  ) {
    return 'SELF';
  }

  // 2. Check blocklist
  if (peerIdentityId && blocklist.includes(peerIdentityId)) {
    return 'BLOCKED';
  }

  // 3. Check contacts list
  const matchedContact = contactsList.find(
    (c) =>
      (peerIdentityId && c?.identityId === peerIdentityId) ||
      (cleanPeerUsername && c?.name?.toLowerCase().replace(/^@/, '').trim() === cleanPeerUsername)
  );

  if (matchedContact) {
    if (matchedContact.status === 'BLOCKED') {
      return 'BLOCKED';
    }
    if ((matchedContact.verificationStatus as any) === 'MISMATCH' || (matchedContact.verificationStatus as any) === 'FAILED') {
      return 'KEY_CHANGED';
    }
    if (matchedContact.verificationStatus === 'VERIFIED') {
      return 'CONTACT_VERIFIED';
    }
    return 'CONTACT_UNVERIFIED';
  }

  // 4. Check contact requests (prioritize active pending requests)
  const activeRequests = requestsList.filter(
    (r) =>
      (peerIdentityId && r?.peerIdentityId === peerIdentityId) ||
      (cleanPeerUsername && r?.peerUsername?.toLowerCase().replace(/^@/, '').trim() === cleanPeerUsername)
  );

  const pendingReq = activeRequests.find(
    (r) => r?.status === 'INCOMING_PENDING' || r?.status === 'OUTGOING_PENDING' || (r?.isIncoming && (r?.status as any) === 'PENDING')
  );

  if (pendingReq) {
    if (pendingReq.status === 'INCOMING_PENDING' || (pendingReq.isIncoming && (pendingReq.status as any) === 'PENDING')) {
      return 'PENDING_INCOMING';
    }
    if (pendingReq.status === 'OUTGOING_PENDING' || (!pendingReq.isIncoming && (pendingReq.status as any) === 'PENDING')) {
      return 'PENDING_OUTGOING';
    }
  }

  const otherReq = activeRequests.find((r) => r?.status === 'BLOCKED' || r?.status === 'ACCEPTED');
  if (otherReq) {
    if (otherReq.status === 'BLOCKED') return 'BLOCKED';
    if (otherReq.status === 'ACCEPTED') return 'CONTACT_UNVERIFIED';
  }

  return 'NOT_CONNECTED';
}
