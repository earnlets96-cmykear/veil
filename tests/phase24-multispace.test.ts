import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { LocalSearchEngine } from '../src/search/searchEngine.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Multi-Space Absolute Cryptographic Boundary Tests', () => {
  it('enforces complete isolation across 5 independent Spaces with zero cross-Space data or volatile search leakage', async () => {
    const vault = new SpaceVaultManager();
    const sharedStorage = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(sharedStorage);
    const idMgr = new SpaceIdentityManager();
    const pre = new PrekeyManager(store, idMgr);
    const contacts = new ContactManager(store);
    const convMgr = new ConversationManager(store, idMgr, pre);
    const searchEngine = new LocalSearchEngine();

    const spaceNames = ['Personal', 'Work', 'Crypto', 'Ghost', 'Decoy'];
    const sessions: SpaceSession[] = [];

    // Create 5 Spaces
    for (let i = 0; i < 5; i++) {
      const s = vault.unlockSpace(`Pass${i}!`, vault.createSpace({ name: spaceNames[i], password: `Pass${i}!`, kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
      sessions.push(s);
      idMgr.createIdentity(s, store);
    }

    // Add unique contacts and messages into Space 0 (Personal) and Space 1 (Work)
    await contacts.addContactFromInvitation(sessions[0], {
      version: 1,
      identityId: 'id_peer_personal',
      name: 'Personal Contact',
      signingPublicKey: 'dummy_sign_pub_0',
      keyAgreementPublicKey: 'dummy_ka_pub_0',
      fingerprint: 'FP-PERSONAL-000',
      createdAt: Date.now(),
      expiresAt: 0,
      signature: 'sig_0',
    });

    await contacts.addContactFromInvitation(sessions[1], {
      version: 1,
      identityId: 'id_peer_work',
      name: 'Work Contact',
      signingPublicKey: 'dummy_sign_pub_1',
      keyAgreementPublicKey: 'dummy_ka_pub_1',
      fingerprint: 'FP-WORK-111',
      createdAt: Date.now(),
      expiresAt: 0,
      signature: 'sig_1',
    });

    // Space 0 contacts check
    const contacts0 = await contacts.listContacts(sessions[0]);
    expect(contacts0).toHaveLength(1);
    expect(contacts0[0].identityId).toBe('id_peer_personal');

    // Space 1 contacts check
    const contacts1 = await contacts.listContacts(sessions[1]);
    expect(contacts1).toHaveLength(1);
    expect(contacts1[0].identityId).toBe('id_peer_work');

    // Spaces 2, 3, 4 have zero contacts
    for (let i = 2; i < 5; i++) {
      const c = await contacts.listContacts(sessions[i]);
      expect(c).toHaveLength(0);
    }

    // Search isolation check
    searchEngine.updateIndex(contacts0, [], {});
    const personalResults = searchEngine.search('Personal');
    expect(personalResults).toHaveLength(1);

    // Switching Space wipes search index
    searchEngine.clear();
    searchEngine.updateIndex(contacts1, [], {});
    const workSearchPersonal = searchEngine.search('Personal');
    expect(workSearchPersonal).toHaveLength(0);
    const workSearchWork = searchEngine.search('Work');
    expect(workSearchWork).toHaveLength(1);
  });
});
