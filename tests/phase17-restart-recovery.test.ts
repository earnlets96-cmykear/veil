import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { bytesToBase64, randomBytes } from '../src/crypto/utils.ts';
import { IdentityDocument } from '../src/identity/document.ts';

describe('VEIL Phase 17: Application Restart & Storage Recovery Tests', () => {
  let sharedAdapter: MemoryStorageAdapter;

  beforeEach(async () => {
    sharedAdapter = new MemoryStorageAdapter();
    await sharedAdapter.init();
  });

  it('STATE SURVIVAL ACROSS RESTART: Recovers encrypted contacts, identities, and settings on cold restart', async () => {
    // 1. Session 1: Create and populate Space
    const vault1 = new SpaceVaultManager();
    const env = vault1.createSpace({ name: 'Personal Space', password: 'PersistentPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    await sharedAdapter.saveEnvelope(env);
    const session1 = vault1.unlockSpace('PersistentPassword123!', env.spaceId);

    const store1 = new EncryptedSpaceStore(sharedAdapter);
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(session1, store1);

    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));
    const peerDoc: IdentityDocument = {
      version: 1,
      identityId: 'id_peer_001',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'ALICE-FP-001',
      createdAt: Date.now(),
      signature: 'sig',
    };
    const inv = InvitationManager.createInvitation(peerDoc, signKp.privateKey, 'Alice Cooper');

    const contactMgr1 = new ContactManager(store1);
    await contactMgr1.addContactFromInvitation(session1, inv);

    // Allow background writes to resolve
    await new Promise((r) => setTimeout(r, 50));

    // Simulate complete process termination & memory zeroization
    session1.destroy();
    expect(session1.isActive()).toBe(false);

    // 2. Session 2: Fresh instances attached to same underlying persistent adapter
    const vault2 = new SpaceVaultManager();
    vault2.registerEnvelope(env);
    const session2 = vault2.unlockSpace('PersistentPassword123!', env.spaceId);

    const store2 = new EncryptedSpaceStore(sharedAdapter);
    const contactMgr2 = new ContactManager(store2);
    const contacts2 = await contactMgr2.listContacts(session2);
    expect(contacts2).toHaveLength(1);
    expect(contacts2[0].name).toBe('Alice Cooper');

    // Load persisted identity document via store2.getAsync
    const doc2 = await store2.getAsync<IdentityDocument>(session2, 'veil:identity:document');
    expect(doc2?.identityId).toBe(doc1.identityId);
    expect(doc2?.fingerprint).toBe(doc1.fingerprint);
  });

  it('PANIC LOCK & SUBSEQUENT RESTART: Panic lock reliably wipes active memory while preserving rest-encrypted data', async () => {
    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Confidential', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', env.spaceId);

    // Destroy via Panic Lock
    session.destroy();
    expect(session.isActive()).toBe(false);
    expect(() => session.getMasterKey()).toThrow();
    expect(() => session.getStorageKey()).toThrow();

    // Re-unlocking requires authentic passphrase
    const reopenedSession = vault.unlockSpace('Pass123!', env.spaceId);
    expect(reopenedSession.isActive()).toBe(true);
    expect(reopenedSession.name).toBe('Confidential');
  });
});
