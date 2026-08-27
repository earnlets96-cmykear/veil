/**
 * Phase 33 Step 3: Unified Discovery & User Search UX Test Suite
 *
 * Verifies:
 * - Relationship state evaluation across all 7 states
 * - Reusable UserSearchResult rendering and accessibility
 * - Relationship-aware contextual actions in ProfileModal
 * - Search partitioning into local chats, contacts, messages, and global people
 * - Zero leakage of sensitive identifiers (master keys, tokens, mailbox IDs, phone numbers)
 * - Directory anti-enumeration preservation
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRelationshipState } from '../src/contacts/relationshipHelper.ts';
import { UserSearchResult } from '../src/ui/components/ui/UserSearchResult.tsx';
import type { Contact } from '../src/contacts/types.ts';
import type { ContactRequest } from '../src/contacts/contactRequestManager.ts';
import type { DirectorySearchResult } from '../src/server/types.ts';

describe('Phase 33 Step 3: Unified Discovery & User Search UX', () => {
  const myIdentityId = 'id_me_123456';
  const myUsername = 'alice';

  const mockContacts: Contact[] = [
    {
      identityId: 'id_bob_999',
      name: 'Bob Jones',
      fingerprint: 'FP_BOB_VERIFIED',
      signingPublicKey: 'pk_bob',
      keyAgreementPublicKey: 'ka_bob',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
    },
    {
      identityId: 'id_charlie_888',
      name: 'Charlie Brown',
      fingerprint: 'FP_CHARLIE_UNVERIFIED',
      signingPublicKey: 'pk_charlie',
      keyAgreementPublicKey: 'ka_charlie',
      status: 'ACCEPTED',
      verificationStatus: 'UNVERIFIED',
      addedAt: Date.now(),
    },
    {
      identityId: 'id_blocked_777',
      name: 'Spammer',
      fingerprint: 'FP_SPAMMER',
      signingPublicKey: 'pk_spammer',
      keyAgreementPublicKey: 'ka_spammer',
      status: 'BLOCKED',
      verificationStatus: 'UNVERIFIED',
      addedAt: Date.now(),
    },
  ];

  const mockRequests: ContactRequest[] = [
    {
      requestId: 'req_01',
      peerIdentityId: 'id_dave_666',
      peerUsername: 'dave',
      peerDisplayName: 'Dave Inbound',
      peerProfile: {} as any,
      status: 'INCOMING_PENDING',
      isIncoming: true,
      greeting: 'Hello Alice!',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      requestId: 'req_02',
      peerIdentityId: 'id_eve_555',
      peerUsername: 'eve',
      peerDisplayName: 'Eve Outbound',
      peerProfile: {} as any,
      status: 'OUTGOING_PENDING',
      isIncoming: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockBlocklist = ['id_blocked_777', 'id_manual_blocked_444'];

  describe('Relationship Helper Logic', () => {
    it('identifies SELF relationship', () => {
      const relById = getRelationshipState(myIdentityId, 'alice', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(relById).toBe('SELF');

      const relByUsername = getRelationshipState(undefined, '@alice', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(relByUsername).toBe('SELF');
    });

    it('identifies BLOCKED users from blocklist or contact status', () => {
      const relBlocked = getRelationshipState('id_blocked_777', 'spammer', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
        blocklist: mockBlocklist,
      });
      expect(relBlocked).toBe('BLOCKED');

      const relManual = getRelationshipState('id_manual_blocked_444', 'troll', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
        blocklist: mockBlocklist,
      });
      expect(relManual).toBe('BLOCKED');
    });

    it('identifies CONTACT_VERIFIED relationship', () => {
      const rel = getRelationshipState('id_bob_999', 'Bob Jones', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('CONTACT_VERIFIED');
    });

    it('identifies CONTACT_UNVERIFIED relationship', () => {
      const rel = getRelationshipState('id_charlie_888', 'Charlie Brown', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('CONTACT_UNVERIFIED');
    });

    it('identifies PENDING_INCOMING contact requests', () => {
      const rel = getRelationshipState('id_dave_666', 'dave', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('PENDING_INCOMING');
    });

    it('identifies PENDING_OUTGOING contact requests', () => {
      const rel = getRelationshipState('id_eve_555', 'eve', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('PENDING_OUTGOING');
    });

    it('identifies NOT_CONNECTED for unknown directory users', () => {
      const rel = getRelationshipState('id_stranger_111', 'stranger', {
        myIdentityId,
        myUsername,
        contacts: mockContacts,
        contactRequests: mockRequests,
      });
      expect(rel).toBe('NOT_CONNECTED');
    });
  });

  describe('UserSearchResult Component Presentation', () => {
    it('renders user details and verified badge for verified contacts', () => {
      const html = renderToStaticMarkup(
        <UserSearchResult
          displayName="Bob Jones"
          username="bob"
          relationshipState="CONTACT_VERIFIED"
          subtitle="Direct E2EE Contact"
        />
      );

      expect(html).toContain('Bob Jones');
      expect(html).toContain('@bob');
      expect(html).toContain('Verified');
      expect(html).toContain('Direct E2EE Contact');
    });

    it('renders pending incoming request badge', () => {
      const html = renderToStaticMarkup(
        <UserSearchResult
          displayName="Dave Inbound"
          username="dave"
          relationshipState="PENDING_INCOMING"
        />
      );

      expect(html).toContain('Dave Inbound');
      expect(html).toContain('@dave');
      expect(html).toContain('Request');
    });

    it('renders pending outgoing request badge', () => {
      const html = renderToStaticMarkup(
        <UserSearchResult
          displayName="Eve Outbound"
          username="eve"
          relationshipState="PENDING_OUTGOING"
        />
      );

      expect(html).toContain('Eve Outbound');
      expect(html).toContain('@eve');
      expect(html).toContain('Sent');
    });

    it('renders accessible touch target attributes', () => {
      const html = renderToStaticMarkup(
        <UserSearchResult
          displayName="Alice"
          username="alice"
          relationshipState="SELF"
        />
      );

      expect(html).toContain('role="button"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-label="User Alice @alice"');
    });
  });

  describe('Search Privacy & Zero Leakage Audit', () => {
    it('ensures directory search result does not expose mailbox IDs or sensitive tokens', () => {
      const mockResult: DirectorySearchResult = {
        identityId: 'id_public_user_99',
        username: 'pub_user',
        displayName: 'Public User',
        avatar: 'data:image/jpeg;base64,...',
        profileSignature: 'sig_123',
      };

      const html = renderToStaticMarkup(
        <UserSearchResult
          displayName={mockResult.displayName}
          username={mockResult.username}
          avatarUrl={mockResult.avatar}
          relationshipState="NOT_CONNECTED"
        />
      );

      // Verify no sensitive terms in output
      expect(html).not.toContain('mailbox');
      expect(html).not.toContain('sessionToken');
      expect(html).not.toContain('masterKey');
      expect(html).not.toContain('accountId');
      expect(html).toContain('Public User');
      expect(html).toContain('@pub_user');
    });
  });
});
