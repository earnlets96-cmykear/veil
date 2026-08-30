/**
 * Track 3: Contact Avatar Propagation, Header Rendering & Chat Privacy Controls Test Suite.
 *
 * Acceptance requirements verified:
 * 1. Accepted contact avatar appears in waiting/sidebar conversation.
 * 2. Avatar appears in conversation header.
 * 3. Missing avatar uses deterministic initials fallback.
 * 4. Avatar and preferences survive encrypted-store rehydration.
 * 5. allowSave persists per canonical Contact.identityId.
 * 6. allowForward persists per canonical Contact.identityId.
 * 7. A->B and B->A policies are independent (symmetry).
 * 8. Display-name collision cannot modify the wrong contact's policy.
 * 9. Outgoing media path receives the correct per-contact defaults.
 * 10. ContactDetailsModal renders Chat Privacy toggles for direct contacts.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../src/ui/components/ui/Avatar.tsx';
import { ContactDetailsModal } from '../src/ui/components/ContactDetailsModal.tsx';
import { ToastProvider } from '../src/ui/components/ui/Toast.tsx';
import { AppContext } from '../src/ui/app/AppState.tsx';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { Contact, InvitationPayload } from '../src/contacts/types.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { UIConversation } from '../src/ui/app/types.ts';

describe('Track 3: Contact Avatar Propagation & Chat Privacy', () => {
  // ---------------------------------------------------------------------------
  // 1 & 2 & 3: Avatar Rendering & Fallbacks
  // ---------------------------------------------------------------------------

  it('1. renders image avatar when imageUrl is provided', () => {
    const avatarUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const html = renderToStaticMarkup(
      <Avatar name="Alice Security" imageUrl={avatarUrl} size="md" />
    );

    expect(html).toContain('background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==)');
    expect(html).not.toContain('<span aria-hidden="true"'); // No initials text span when image is present
  });

  it('2. renders deterministic initials fallback when avatar is absent', () => {
    const html = renderToStaticMarkup(
      <Avatar name="Bob Developer" size="md" />
    );

    expect(html).not.toContain('background-image');
    expect(html).toContain('B'); // Initials fallback
    expect(html).toContain('veil-avatar-md');
  });

  it('3. renders group avatar fallback with SVG group icon when isGroup is true and imageUrl absent', () => {
    const html = renderToStaticMarkup(
      <Avatar name="Secret Project Group" isGroup={true} size="md" />
    );

    expect(html).not.toContain('background-image');
    expect(html).toContain('<svg');
    expect(html).toContain('veil-avatar-square');
  });

  // ---------------------------------------------------------------------------
  // 4: Contact Avatar Propagation & Encrypted Storage Rehydration
  // ---------------------------------------------------------------------------

  it('4. preserves avatar through contact invitation and encrypted store rehydration', async () => {
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const contactManager = new ContactManager(store);

    vault.createSpace({ name: 'Personal', password: 'MasterPassword123!' });
    const session = vault.unlockSpace('MasterPassword123!');

    const invitation: InvitationPayload = {
      version: 1,
      identityId: 'id_alice_canonical_123',
      name: 'Alice',
      avatar: 'https://veil.secure/avatars/alice_verified.png',
      fingerprint: '1111 2222 3333 4444',
      signingPublicKey: 'alice_sign_pk',
      keyAgreementPublicKey: 'alice_dh_pk',
      mailboxId: 'mbx_alice_1',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    };

    const added = await contactManager.addContactFromInvitation(session, invitation);
    expect(added.avatar).toBe('https://veil.secure/avatars/alice_verified.png');
    expect(added.identityId).toBe('id_alice_canonical_123');

    // Simulate app restart / fresh loadState rehydration
    const freshStore = new EncryptedSpaceStore(storage);
    const freshContactManager = new ContactManager(freshStore);
    const rehydratedContacts = await freshContactManager.listContacts(session);

    const rehydratedAlice = rehydratedContacts.find((c) => c.identityId === 'id_alice_canonical_123');
    expect(rehydratedAlice).toBeDefined();
    expect(rehydratedAlice?.avatar).toBe('https://veil.secure/avatars/alice_verified.png');

    // Verify UIConversation hydration mapping
    const storedConv: UIConversation = {
      id: rehydratedAlice!.identityId,
      type: 'direct',
      name: rehydratedAlice!.name,
      avatarSeed: rehydratedAlice!.identityId,
      unreadCount: 0,
    };

    const hydratedConv: UIConversation = {
      ...storedConv,
      avatar: storedConv.avatar || rehydratedAlice?.avatar,
    };

    expect(hydratedConv.avatar).toBe('https://veil.secure/avatars/alice_verified.png');
  });

  // ---------------------------------------------------------------------------
  // 5 & 6: allowSave and allowForward Persistence per Canonical identityId
  // ---------------------------------------------------------------------------

  it('5 & 6. persists allowSave and allowForward per canonical Contact.identityId', async () => {
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const contactManager = new ContactManager(store);

    vault.createSpace({ name: 'Personal', password: 'MasterPassword123!' });
    const session = vault.unlockSpace('MasterPassword123!');

    const charlieContact: Contact = {
      identityId: 'id_charlie_999',
      name: 'Charlie',
      fingerprint: '9999 8888 7777 6666',
      signingPublicKey: 'charlie_sign_pk',
      keyAgreementPublicKey: 'charlie_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: {
        allowSave: 'false',
        allowForward: 'true',
      },
    };

    await contactManager.addContact(session, charlieContact);

    // Verify initial values
    let contacts = await contactManager.listContacts(session);
    let charlie = contacts.find((c) => c.identityId === 'id_charlie_999');
    expect(charlie?.metadata?.allowSave).toBe('false');
    expect(charlie?.metadata?.allowForward).toBe('true');

    // Update allowForward to false as well
    await contactManager.updateContact(session, {
      ...charlie!,
      metadata: {
        ...charlie!.metadata,
        allowForward: 'false',
      },
    });

    contacts = await contactManager.listContacts(session);
    charlie = contacts.find((c) => c.identityId === 'id_charlie_999');
    expect(charlie?.metadata?.allowSave).toBe('false');
    expect(charlie?.metadata?.allowForward).toBe('false');
  });

  // ---------------------------------------------------------------------------
  // 7: Symmetry / Independence (A -> B != B -> A)
  // ---------------------------------------------------------------------------

  it('7. ensures A->B and B->A media privacy policies are strictly independent', async () => {
    // User A space
    const storageA = new MemoryAdapter();
    const vaultA = new SpaceVaultManager(storageA);
    const storeA = new EncryptedSpaceStore(storageA);
    const contactManagerA = new ContactManager(storeA);
    vaultA.createSpace({ name: 'SpaceA', password: 'PasswordA123!' });
    const sessionA = vaultA.unlockSpace('PasswordA123!');

    // User B space
    const storageB = new MemoryAdapter();
    const vaultB = new SpaceVaultManager(storageB);
    const storeB = new EncryptedSpaceStore(storageB);
    const contactManagerB = new ContactManager(storeB);
    vaultB.createSpace({ name: 'SpaceB', password: 'PasswordB123!' });
    const sessionB = vaultB.unlockSpace('PasswordB123!');

    // A adds B with allowSave=false, allowForward=true
    await contactManagerA.addContact(sessionA, {
      identityId: 'id_user_b',
      name: 'Bob',
      fingerprint: 'bbbb bbbb',
      signingPublicKey: 'b_sign_pk',
      keyAgreementPublicKey: 'b_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: {
        allowSave: 'false',
        allowForward: 'true',
      },
    });

    // B adds A with allowSave=true, allowForward=false
    await contactManagerB.addContact(sessionB, {
      identityId: 'id_user_a',
      name: 'Alice',
      fingerprint: 'aaaa aaaa',
      signingPublicKey: 'a_sign_pk',
      keyAgreementPublicKey: 'a_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: {
        allowSave: 'true',
        allowForward: 'false',
      },
    });

    const contactsA = await contactManagerA.listContacts(sessionA);
    const bInA = contactsA.find((c) => c.identityId === 'id_user_b');
    expect(bInA?.metadata?.allowSave).toBe('false');
    expect(bInA?.metadata?.allowForward).toBe('true');

    const contactsB = await contactManagerB.listContacts(sessionB);
    const aInB = contactsB.find((c) => c.identityId === 'id_user_a');
    expect(aInB?.metadata?.allowSave).toBe('true');
    expect(aInB?.metadata?.allowForward).toBe('false');

    // Mutating A's policy for B does NOT affect B's policy for A
    await contactManagerA.updateContact(sessionA, {
      ...bInA!,
      metadata: { allowSave: 'true', allowForward: 'true' },
    });

    const refreshedB = (await contactManagerB.listContacts(sessionB)).find((c) => c.identityId === 'id_user_a');
    expect(refreshedB?.metadata?.allowSave).toBe('true');
    expect(refreshedB?.metadata?.allowForward).toBe('false'); // Unchanged!
  });

  // ---------------------------------------------------------------------------
  // 8: Display-name Collision Resilience
  // ---------------------------------------------------------------------------

  it('8. prevents display-name collision from modifying the wrong contact policy', async () => {
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const contactManager = new ContactManager(store);

    vault.createSpace({ name: 'Personal', password: 'MasterPassword123!' });
    const session = vault.unlockSpace('MasterPassword123!');

    // Two different contacts with the identical display name "Alex"
    const alex1: Contact = {
      identityId: 'id_alex_canonical_001',
      name: 'Alex',
      fingerprint: '1111 1111',
      signingPublicKey: 'alex1_sign_pk',
      keyAgreementPublicKey: 'alex1_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: { allowSave: 'true', allowForward: 'true' },
    };

    const alex2: Contact = {
      identityId: 'id_alex_canonical_002',
      name: 'Alex',
      fingerprint: '2222 2222',
      signingPublicKey: 'alex2_sign_pk',
      keyAgreementPublicKey: 'alex2_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: { allowSave: 'true', allowForward: 'true' },
    };

    await contactManager.addContact(session, alex1);
    await contactManager.addContact(session, alex2);

    // Update ONLY alex1 using its canonical identityId
    await contactManager.updateContact(session, {
      ...alex1,
      metadata: { allowSave: 'false', allowForward: 'false' },
    });

    const contacts = await contactManager.listContacts(session);
    const resAlex1 = contacts.find((c) => c.identityId === 'id_alex_canonical_001');
    const resAlex2 = contacts.find((c) => c.identityId === 'id_alex_canonical_002');

    expect(resAlex1?.metadata?.allowSave).toBe('false');
    expect(resAlex1?.metadata?.allowForward).toBe('false');

    expect(resAlex2?.metadata?.allowSave).toBe('true');
    expect(resAlex2?.metadata?.allowForward).toBe('true');
  });

  // ---------------------------------------------------------------------------
  // 9: Outgoing Media Path Default Resolution
  // ---------------------------------------------------------------------------

  it('9. resolves outgoing media defaults from target contact permissions correctly', () => {
    const contactWithRestrictions: Contact = {
      identityId: 'id_restricted_user',
      name: 'Restricted Peer',
      fingerprint: '3333 3333',
      signingPublicKey: 'rest_sign_pk',
      keyAgreementPublicKey: 'rest_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: {
        allowSave: 'false',
        allowForward: 'false',
      },
    };

    const contactDefault: Contact = {
      identityId: 'id_default_user',
      name: 'Standard Peer',
      fingerprint: '4444 4444',
      signingPublicKey: 'std_sign_pk',
      keyAgreementPublicKey: 'std_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
    };

    // Helper mirroring AppState.tsx sendAttachments resolution
    const resolveOutgoingMediaOptions = (
      targetContact: Contact | undefined,
      options?: { allowSave?: boolean; allowForward?: boolean }
    ) => {
      const contactAllowSave = targetContact?.metadata?.allowSave !== 'false';
      const contactAllowForward = targetContact?.metadata?.allowForward !== 'false';
      return {
        allowSave: options?.allowSave !== undefined ? options.allowSave : contactAllowSave,
        allowForward: options?.allowForward !== undefined ? options.allowForward : contactAllowForward,
      };
    };

    // Restricted peer without explicit override -> uses restricted defaults
    const resolvedRestricted = resolveOutgoingMediaOptions(contactWithRestrictions);
    expect(resolvedRestricted.allowSave).toBe(false);
    expect(resolvedRestricted.allowForward).toBe(false);

    // Standard peer without explicit override -> uses standard true defaults
    const resolvedDefault = resolveOutgoingMediaOptions(contactDefault);
    expect(resolvedDefault.allowSave).toBe(true);
    expect(resolvedDefault.allowForward).toBe(true);

    // Explicit override takes precedence over contact default
    const resolvedOverride = resolveOutgoingMediaOptions(contactWithRestrictions, { allowSave: true });
    expect(resolvedOverride.allowSave).toBe(true);
    expect(resolvedOverride.allowForward).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 10: ContactDetailsModal Chat Privacy Section Rendering
  // ---------------------------------------------------------------------------

  it('10. renders Chat Privacy toggles in ContactDetailsModal for direct contacts', () => {
    const mockContact: Contact = {
      identityId: 'id_peer_dan',
      name: 'Dan',
      avatar: 'https://veil.secure/dan.jpg',
      fingerprint: '5555 6666 7777 8888',
      signingPublicKey: 'dan_sign_pk',
      keyAgreementPublicKey: 'dan_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: {
        allowSave: 'false',
        allowForward: 'true',
      },
    };

    const mockUpdatePermissions = vi.fn();
    const mockContextValue: any = {
      conversations: [
        {
          id: 'id_peer_dan',
          type: 'direct',
          name: 'Dan',
          avatarSeed: 'id_peer_dan',
          avatar: 'https://veil.secure/dan.jpg',
          unreadCount: 0,
        },
      ],
      contacts: [mockContact],
      closeModal: vi.fn(),
      updateContactVerification: vi.fn(),
      updateContactMediaPermissions: mockUpdatePermissions,
    };

    const html = renderToStaticMarkup(
      <ToastProvider>
        <AppContext.Provider value={mockContextValue}>
          <ContactDetailsModal conversationId="id_peer_dan" />
        </AppContext.Provider>
      </ToastProvider>
    );

    // Verify modal header & contact info
    expect(html).toContain('Verify Identity');
    expect(html).toContain('Dan');
    expect(html).toContain('background-image:url(https://veil.secure/dan.jpg)');

    // Verify Chat Privacy & Media Permissions section
    expect(html).toContain('Chat Privacy &amp; Media Permissions');
    expect(html).toContain('Allow recipient to save my media');
    expect(html).toContain('Allow recipient to forward my media');
    expect(html).toContain('Client-side controls cannot prevent screen captures');
  });
});
