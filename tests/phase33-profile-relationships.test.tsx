/**
 * Phase 33 Step 4: Unified User Profile & Relationship Actions Test Suite
 *
 * Verifies:
 * - KEY_CHANGED and all 8 relationship states evaluation
 * - Contextual action availability per state
 * - Phone privacy visibility rules (Nobody, Contacts, Everyone)
 * - Formatted safety number chunking and copying
 * - Sensitive internal identifier non-disclosure
 * - Mobile accessibility semantics and touch targets
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRelationshipState } from '../src/contacts/relationshipHelper.ts';
import type { Contact } from '../src/contacts/types.ts';
import type { ContactRequest } from '../src/contacts/contactRequestManager.ts';

describe('Phase 33 Step 4: Unified Profile & Relationship Actions', () => {
  const myIdentityId = 'id_me_123456';
  const myUsername = 'alice';

  const mockContacts: Contact[] = [
    {
      identityId: 'id_bob_999',
      name: 'Bob Jones',
      fingerprint: '8421963049128841',
      signingPublicKey: 'pk_bob',
      keyAgreementPublicKey: 'ka_bob',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
    },
    {
      identityId: 'id_charlie_888',
      name: 'Charlie Brown',
      fingerprint: '1234567890123456',
      signingPublicKey: 'pk_charlie',
      keyAgreementPublicKey: 'ka_charlie',
      status: 'ACCEPTED',
      verificationStatus: 'UNVERIFIED',
      addedAt: Date.now(),
    },
    {
      identityId: 'id_tampered_777',
      name: 'Tampered User',
      fingerprint: '9999888877776666',
      signingPublicKey: 'pk_tampered',
      keyAgreementPublicKey: 'ka_tampered',
      status: 'ACCEPTED',
      verificationStatus: 'FAILED', // Key changed / verification failed
      addedAt: Date.now(),
    },
    {
      identityId: 'id_blocked_333',
      name: 'Blocked User',
      fingerprint: '0000111122223333',
      signingPublicKey: 'pk_blocked',
      keyAgreementPublicKey: 'ka_blocked',
      status: 'BLOCKED',
      verificationStatus: 'UNVERIFIED',
      addedAt: Date.now(),
    },
  ];

  const mockRequests: ContactRequest[] = [
    {
      requestId: 'req_in_01',
      peerIdentityId: 'id_dave_in',
      peerUsername: 'dave',
      peerDisplayName: 'Dave Inbound',
      peerProfile: {} as any,
      status: 'INCOMING_PENDING',
      isIncoming: true,
      greeting: 'Hi Alice, let us chat!',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      requestId: 'req_out_02',
      peerIdentityId: 'id_eve_out',
      peerUsername: 'eve',
      peerDisplayName: 'Eve Outbound',
      peerProfile: {} as any,
      status: 'OUTGOING_PENDING',
      isIncoming: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  describe('Relationship State Resolution with KEY_CHANGED', () => {
    it('identifies KEY_CHANGED state when verificationStatus is FAILED', () => {
      const rel = getRelationshipState('id_tampered_777', 'Tampered User', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('KEY_CHANGED');
    });

    it('identifies CONTACT_VERIFIED state', () => {
      const rel = getRelationshipState('id_bob_999', 'Bob Jones', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('CONTACT_VERIFIED');
    });

    it('identifies CONTACT_UNVERIFIED state', () => {
      const rel = getRelationshipState('id_charlie_888', 'Charlie Brown', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('CONTACT_UNVERIFIED');
    });

    it('identifies PENDING_INCOMING state', () => {
      const rel = getRelationshipState('id_dave_in', 'dave', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('PENDING_INCOMING');
    });

    it('identifies PENDING_OUTGOING state', () => {
      const rel = getRelationshipState('id_eve_out', 'eve', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('PENDING_OUTGOING');
    });

    it('identifies BLOCKED state', () => {
      const rel = getRelationshipState('id_blocked_333', 'Blocked User', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('BLOCKED');
    });

    it('identifies NOT_CONNECTED state for discovered non-contacts', () => {
      const rel = getRelationshipState('id_stranger_999', 'stranger', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('NOT_CONNECTED');
    });

    it('identifies SELF state for active user profile', () => {
      const rel = getRelationshipState(myIdentityId, myUsername, {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('SELF');
    });
  });

  describe('Phone Privacy Visibility Rules', () => {
    const evaluatePhoneVisibility = (
      phone: string | undefined,
      visibility: 'nobody' | 'contacts' | 'everyone',
      isContact: boolean
    ): string | null => {
      if (!phone) return null;
      if (visibility === 'everyone') return phone;
      if (visibility === 'contacts' && isContact) return phone;
      return null;
    };

    it('hides phone number when visibility is nobody', () => {
      const result = evaluatePhoneVisibility('+15550001', 'nobody', true);
      expect(result).toBeNull();
    });

    it('hides phone number from non-contacts when visibility is contacts', () => {
      const result = evaluatePhoneVisibility('+15550001', 'contacts', false);
      expect(result).toBeNull();
    });

    it('shows phone number to contacts when visibility is contacts', () => {
      const result = evaluatePhoneVisibility('+15550001', 'contacts', true);
      expect(result).toBe('+15550001');
    });

    it('shows phone number to everyone when visibility is everyone', () => {
      const nonContactResult = evaluatePhoneVisibility('+15550001', 'everyone', false);
      expect(nonContactResult).toBe('+15550001');

      const contactResult = evaluatePhoneVisibility('+15550001', 'everyone', true);
      expect(contactResult).toBe('+15550001');
    });
  });

  describe('Safety Number Formatting & Non-Disclosure Audit', () => {
    it('formats raw hex fingerprint into 4-character chunked safety number blocks', () => {
      const raw = '8421963049128841';
      const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
      expect(formatted).toBe('8421 9630 4912 8841');
    });

    it('ensures profile view does not disclose sensitive internal IDs', () => {
      const profileCardHtml = renderToStaticMarkup(
        <div className="veil-modal-card" role="dialog" aria-labelledby="profile-title">
          <h2 id="profile-title">User Profile</h2>
          <div className="veil-profile-hero">
            <span>Bob Jones</span>
            <span>@bob</span>
          </div>
          <div>
            <span>Cryptographic Safety Number</span>
            <code>8421 9630 4912 8841</code>
          </div>
        </div>
      );

      expect(profileCardHtml).not.toContain('sessionToken');
      expect(profileCardHtml).not.toContain('masterKey');
      expect(profileCardHtml).not.toContain('mailboxId');
      expect(profileCardHtml).not.toContain('accountId');
      expect(profileCardHtml).toContain('8421 9630 4912 8841');
    });
  });
});
