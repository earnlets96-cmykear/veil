import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager, ContactRequestWire } from '../src/contacts/contactRequestManager.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Contact Blocking & Harassment Defense Tests', () => {
  it('enforces blocklist and drops requests from blocked identities', async () => {
    // 1. User setup
    const vaultA = new SpaceVaultManager();
    const sA = vaultA.unlockSpace('PassA!', vaultA.createSpace({ name: 'User A', password: 'PassA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    idMgrA.createIdentity(sA, storeA);
    const contactsA = new ContactManager(storeA);
    const reqMgrA = new ContactRequestManager(storeA, contactsA, idMgrA);

    // 2. Spammer setup
    const vaultB = new SpaceVaultManager();
    const sB = vaultB.unlockSpace('PassB!', vaultB.createSpace({ name: 'Spammer', password: 'PassB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    const docB = idMgrB.createIdentity(sB, storeB);
    const idB = idMgrB.loadIdentity(sB, storeB)!;
    const preB = new PrekeyManager(storeB, idMgrB);
    preB.generateSignedPrekey(sB);
    const bundleB = preB.createPrekeyBundle(sB);

    const spammerProfile = createSignedProfile(
      docB.identityId,
      idB.signingPrivateKey,
      'spammer_user',
      'Spammer',
      'mb_spammer',
      bundleB
    );

    // 3. User blocks spammer identity
    await reqMgrA.blockUser(sA, docB.identityId);
    expect(await reqMgrA.isBlocked(sA, docB.identityId)).toBe(true);

    // 4. Spammer sends contact request to User A
    const spamWire: ContactRequestWire = {
      type: 'CONTACT_REQUEST',
      requestId: 'req_spam_123',
      senderProfile: spammerProfile,
      greeting: 'Spam message',
      sentAt: Date.now(),
      signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
    };

    // User A processes inbound request -> silently dropped (returns null)
    const result = await reqMgrA.handleInboundRequest(sA, spamWire);
    expect(result).toBeNull();

    // Verify no request is recorded in pending incoming requests
    const pending = await reqMgrA.listRequests(sA);
    const incomingPending = pending.filter((r) => r.status === 'INCOMING_PENDING');
    expect(incomingPending).toHaveLength(0);

    // 5. Unblock spammer -> now requests can be processed if valid
    await reqMgrA.unblockUser(sA, docB.identityId);
    expect(await reqMgrA.isBlocked(sA, docB.identityId)).toBe(false);
  });
});
