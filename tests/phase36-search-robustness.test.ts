/**
 * VEIL Phase 36 Test Suite — Search Robustness & Same-Device Multi-Account Isolation.
 *
 * Verifies that:
 * 1. getRelationshipState handles undefined/null contacts & contactRequests gracefully.
 * 2. Positional and object parameter invocations work identically without crashing.
 * 3. Same-device account search identifies self vs peer accurately.
 * 4. Zero TypeError exceptions occur during directory discovery.
 */

import { describe, it, expect } from 'vitest';
import { getRelationshipState, RelationshipContext } from '../src/contacts/relationshipHelper.ts';
import { Contact } from '../src/contacts/types.ts';
import { ContactRequest } from '../src/contacts/contactRequestManager.ts';

describe('Phase 36: Search Robustness & Same-Device Relationship Resolution', () => {
  it('correctly identifies SELF identity and usernames', () => {
    const ctx: RelationshipContext = {
      myIdentityId: 'id-alice-123',
      myUsername: 'alice',
      contacts: [],
      contactRequests: [],
    };

    expect(getRelationshipState('id-alice-123', 'alice', ctx)).toBe('SELF');
    expect(getRelationshipState(undefined, '@alice', ctx)).toBe('SELF');
    expect(getRelationshipState('id-alice-123', 'different_name', ctx)).toBe('SELF');
  });

  it('safely handles undefined contacts and contactRequests without throwing', () => {
    // Malformed/empty context
    const brokenCtx = {} as RelationshipContext;
    expect(() => getRelationshipState('id-peer-999', 'bob', brokenCtx)).not.toThrow();
    expect(getRelationshipState('id-peer-999', 'bob', brokenCtx)).toBe('NOT_CONNECTED');

    // Passing null/undefined context
    expect(() => getRelationshipState('id-peer-999', 'bob', undefined as any)).not.toThrow();
    expect(getRelationshipState('id-peer-999', 'bob', undefined as any)).toBe('NOT_CONNECTED');
  });

  it('supports positional arguments fallback signature without crashing', () => {
    const contacts: Contact[] = [
      {
        identityId: 'id-contact-1',
        name: 'Charlie',
        fingerprint: '1234',
        addedAt: Date.now(),
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
    ];

    const requests: ContactRequest[] = [
      {
        requestId: 'req-1',
        mailboxId: 'mbx-1',
        peerIdentityId: 'id-pending-1',
        peerUsername: 'david',
        status: 'INCOMING_PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    // Positional signature: (peerId, peerUsername, contacts, requests)
    const resVerified = getRelationshipState('id-contact-1', 'Charlie', contacts as any, requests);
    expect(resVerified).toBe('CONTACT_VERIFIED');

    const resPending = getRelationshipState('id-pending-1', 'david', contacts as any, requests);
    expect(resPending).toBe('PENDING_INCOMING');

    const resUnknown = getRelationshipState('id-unknown', 'stranger', contacts as any, requests);
    expect(resUnknown).toBe('NOT_CONNECTED');
  });

  it('identifies blocked contacts and key changed contacts', () => {
    const contacts: Contact[] = [
      {
        identityId: 'id-blocked',
        name: 'Eve',
        fingerprint: '5678',
        addedAt: Date.now(),
        status: 'BLOCKED',
        verificationStatus: 'UNVERIFIED',
      },
      {
        identityId: 'id-changed',
        name: 'Frank',
        fingerprint: '9999',
        addedAt: Date.now(),
        status: 'ACTIVE',
        verificationStatus: 'FAILED',
      },
    ];

    const ctx: RelationshipContext = {
      myIdentityId: 'id-self',
      contacts,
      contactRequests: [],
    };

    expect(getRelationshipState('id-blocked', 'Eve', ctx)).toBe('BLOCKED');
    expect(getRelationshipState('id-changed', 'Frank', ctx)).toBe('KEY_CHANGED');
  });
});
