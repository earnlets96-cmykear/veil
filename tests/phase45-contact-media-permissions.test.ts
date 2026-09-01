/**
 * Phase 45: Contact Profile Media Permissions Test Suite.
 *
 * Verifies:
 * 1. Contact metadata stores allowSave and allowForward permissions in encrypted Space storage.
 * 2. Updating contact media permissions is persisted and reflected in contact queries.
 * 3. Default permissions are allowSave = true, allowForward = true.
 * 4. Custom permissions allow restricting media saving or forwarding per contact.
 */

import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { Contact } from '../src/contacts/types.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 45: Contact Profile Media Permissions', () => {
  it('stores and updates allowSave and allowForward permissions per contact', async () => {
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const contactManager = new ContactManager(store);

    vault.createSpace({ name: 'Personal', password: 'SecretPass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('SecretPass123!');

    const bobContact: Contact = {
      identityId: 'id_bob_123',
      name: 'Bob',
      fingerprint: '1234 5678',
      signingPublicKey: 'bob_sign_pk',
      keyAgreementPublicKey: 'bob_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'VERIFIED',
      addedAt: Date.now(),
      metadata: {
        allowSave: 'true',
        allowForward: 'true',
      },
    };

    await contactManager.addContact(session, bobContact);

    // Verify initial permissions
    let contacts = await contactManager.listContacts(session);
    let bob = contacts.find((c) => c.identityId === 'id_bob_123');
    expect(bob).toBeDefined();
    expect(bob?.metadata?.allowSave).toBe('true');
    expect(bob?.metadata?.allowForward).toBe('true');

    // Update permissions: disallow save, allow forward
    await contactManager.updateContact(session, {
      ...bob!,
      metadata: {
        ...bob!.metadata,
        allowSave: 'false',
        allowForward: 'true',
      },
    });

    contacts = await contactManager.listContacts(session);
    bob = contacts.find((c) => c.identityId === 'id_bob_123');
    expect(bob?.metadata?.allowSave).toBe('false');
    expect(bob?.metadata?.allowForward).toBe('true');

    // Update permissions: disallow forward as well
    await contactManager.updateContact(session, {
      ...bob!,
      metadata: {
        ...bob!.metadata,
        allowForward: 'false',
      },
    });

    contacts = await contactManager.listContacts(session);
    bob = contacts.find((c) => c.identityId === 'id_bob_123');
    expect(bob?.metadata?.allowSave).toBe('false');
    expect(bob?.metadata?.allowForward).toBe('false');
  });

  it('correctly interprets missing metadata as default allowed (true)', async () => {
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const contactManager = new ContactManager(store);

    vault.createSpace({ name: 'Personal', password: 'SecretPass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('SecretPass123!');

    const charlieContact: Contact = {
      identityId: 'id_charlie_456',
      name: 'Charlie',
      fingerprint: '9876 5432',
      signingPublicKey: 'charlie_sign_pk',
      keyAgreementPublicKey: 'charlie_dh_pk',
      status: 'ACCEPTED',
      verificationStatus: 'UNVERIFIED',
      addedAt: Date.now(),
    };

    await contactManager.addContact(session, charlieContact);

    const contacts = await contactManager.listContacts(session);
    const charlie = contacts.find((c) => c.identityId === 'id_charlie_456');

    const allowSave = charlie?.metadata?.allowSave !== 'false';
    const allowForward = charlie?.metadata?.allowForward !== 'false';

    expect(allowSave).toBe(true);
    expect(allowForward).toBe(true);
  });
});
