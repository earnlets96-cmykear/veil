import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { createSignedProfile, SignedProfileDocument } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Android Lifecycle & Restart Persistence for Discovery Tests', () => {
  it('persists profile, contact requests, and blocklists across complete process teardown and restart', async () => {
    const sharedStorage = new MemoryStorageAdapter();

    // -----------------------------------------------------------------
    // SESSION 1: Initial Setup & Creation
    // -----------------------------------------------------------------
    const vault1 = new SpaceVaultManager();
    const envRecord = vault1.createSpace({ name: 'Android User', password: 'MasterPass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    await vault1.saveEnvelopeToStorage(envRecord, sharedStorage);

    const s1 = vault1.unlockSpace('MasterPass123!', envRecord.spaceId);
    const store1 = new EncryptedSpaceStore(sharedStorage);
    await store1.loadPartitionFromStorage(s1);

    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    const bundle1 = pre1.createPrekeyBundle(s1);

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'android_master', 'Android User', 'mb_android', bundle1);
    await store1.setAsync(s1, 'veil:user:profile', profile1);

    const contacts1 = new ContactManager(store1);
    const reqMgr1 = new ContactRequestManager(store1, contacts1, idMgr1);

    // Add a pending incoming request
    const peerDoc = idMgr1.createIdentity(s1, new EncryptedSpaceStore(new MemoryStorageAdapter()));
    const peerProfile = createSignedProfile(peerDoc.identityId, id1.signingPrivateKey, 'peer_user', 'Peer User', 'mb_peer', bundle1);

    await reqMgr1.handleInboundRequest(s1, {
      type: 'CONTACT_REQUEST',
      requestId: 'req_android_persist_1',
      senderProfile: peerProfile,
      greeting: 'Persisted across restart',
      sentAt: Date.now(),
      signature: peerProfile.signature,
    });

    // Block an attacker
    await reqMgr1.blockUser(s1, 'id_blocked_attacker_999');

    // -----------------------------------------------------------------
    // COLD PROCESS TEARDOWN & RESTART
    // All in-memory variables destroyed
    // -----------------------------------------------------------------
    const vault2 = new SpaceVaultManager();
    await vault2.loadEnvelopesFromStorage(sharedStorage);
    const s2 = vault2.unlockSpace('MasterPass123!', envRecord.spaceId);

    const store2 = new EncryptedSpaceStore(sharedStorage);
    await store2.loadPartitionFromStorage(s2);

    const idMgr2 = new SpaceIdentityManager();
    const loadedDoc = idMgr2.getPublicDocument(s2, store2);
    expect(loadedDoc?.identityId).toBe(doc1.identityId);

    const loadedProfile = await store2.getAsync<SignedProfileDocument>(s2, 'veil:user:profile');
    expect(loadedProfile?.username).toBe('android_master');

    const contacts2 = new ContactManager(store2);
    const reqMgr2 = new ContactRequestManager(store2, contacts2, idMgr2);

    const loadedRequests = await reqMgr2.listRequests(s2);
    expect(loadedRequests).toHaveLength(1);
    expect(loadedRequests[0].peerUsername).toBe('peer_user');
    expect(loadedRequests[0].greeting).toBe('Persisted across restart');

    expect(await reqMgr2.isBlocked(s2, 'id_blocked_attacker_999')).toBe(true);
  });
});
