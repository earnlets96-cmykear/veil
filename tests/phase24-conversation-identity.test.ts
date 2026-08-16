import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Conversation Identity Model & Boundary Invariant Tests', () => {
  it('strictly maps conversationId to peerIdentityId and prevents split histories across handle updates', async () => {
    const vault = new SpaceVaultManager();
    const s1 = vault.unlockSpace('P1!', vault.createSpace({ name: 'Phone 1', password: 'P1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    idMgr.createIdentity(s1, store);
    const pre = new PrekeyManager(store, idMgr);
    const contacts = new ContactManager(store);
    const convMgr = new ConversationManager(store, idMgr, pre);

    // Setup peer identity
    const s2 = vault.unlockSpace('P2!', vault.createSpace({ name: 'Phone 2', password: 'P2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    const bundle2 = pre2.createPrekeyBundle(s2);

    // Initial Contact Record
    await contacts.addContactFromInvitation(s1, {
      version: 1,
      identityId: doc2.identityId,
      name: 'Initial Name (@phone2_old)',
      signingPublicKey: doc2.signingPublicKey,
      keyAgreementPublicKey: doc2.keyAgreementPublicKey,
      fingerprint: doc2.fingerprint,
      mailboxId: 'mb_initial_123',
      prekeyBundle: bundle2,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: doc2.signature,
    });

    // Send first message
    const { storedMessage: msg1 } = await convMgr.encryptAndPackWireMessage(s1, bundle2, 'First Message');
    expect(msg1.conversationId).toBe(doc2.identityId);

    // Peer updates handle/name in address book via update / invitation refresh
    await contacts.addContactFromInvitation(s1, {
      version: 1,
      identityId: doc2.identityId,
      name: 'Updated Name (@phone2_new)',
      signingPublicKey: doc2.signingPublicKey,
      keyAgreementPublicKey: doc2.keyAgreementPublicKey,
      fingerprint: doc2.fingerprint,
      mailboxId: 'mb_initial_123',
      prekeyBundle: bundle2,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: doc2.signature,
    });

    // Send second message
    const { storedMessage: msg2 } = await convMgr.encryptAndPackWireMessage(s1, bundle2, 'Second Message');
    expect(msg2.conversationId).toBe(doc2.identityId);

    // Verify both messages belong to the EXACT same conversationId (doc2.identityId)
    expect(msg1.conversationId).toBe(msg2.conversationId);

    const contact = await contacts.getContact(s1, doc2.identityId);
    expect(contact?.name).toBe('Updated Name (@phone2_new)');
    expect(contact?.identityId).toBe(doc2.identityId);
  });
});
