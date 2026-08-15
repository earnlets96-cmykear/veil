import { describe, it, expect, beforeEach } from 'vitest';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { bytesToBase64, randomBytes } from '../src/crypto/utils.ts';
import { IdentityDocument } from '../src/identity/document.ts';

describe('VEIL Phase 15: Contact Onboarding & Space Isolation Tests', () => {
  let vault: SpaceVaultManager;
  let adapter: MemoryStorageAdapter;
  let store: EncryptedSpaceStore;
  let contactMgr: ContactManager;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
    contactMgr = new ContactManager(store);
  });

  it('CONTACT ONBOARDING: Imports signed invitation and persists in Space store', async () => {
    const envA = vault.createSpace({ name: 'Personal', password: 'PasswordA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vault.unlockSpace('PasswordA123!', envA.spaceId);

    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));
    const bobDoc: IdentityDocument = {
      version: 1,
      identityId: 'id_bob_123',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'BOB-FINGERPRINT-999',
      createdAt: Date.now(),
      signature: 'sig',
    };

    const invitation = InvitationManager.createInvitation(bobDoc, signKp.privateKey, 'Bob');
    const contact = await contactMgr.addContactFromInvitation(sessionA, invitation);

    expect(contact.identityId).toBe('id_bob_123');
    expect(contact.name).toBe('Bob');
    expect(contact.verificationStatus).toBe('UNVERIFIED');

    // Verify contact retrieval
    const list = await contactMgr.listContacts(sessionA);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Bob');
  });

  it('CROSS-SPACE CONTACT ISOLATION: Contacts in Space A do not appear in Space B', async () => {
    const envA = vault.createSpace({ name: 'Space A', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'Space B', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vault.unlockSpace('PassA', envA.spaceId);
    const sessionB = vault.unlockSpace('PassB', envB.spaceId);

    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));
    const aliceDoc: IdentityDocument = {
      version: 1,
      identityId: 'id_alice_777',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'ALICE-FP-777',
      createdAt: Date.now(),
      signature: 'sig',
    };
    const inv = InvitationManager.createInvitation(aliceDoc, signKp.privateKey, 'Alice');

    await contactMgr.addContactFromInvitation(sessionA, inv);

    // Space A has 1 contact, Space B has 0
    expect(await contactMgr.listContacts(sessionA)).toHaveLength(1);
    expect(await contactMgr.listContacts(sessionB)).toHaveLength(0);
  });
});
