import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { createSignedProfile, SignedProfileDocument } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Android Lifecycle, Kill & Rehydration Tests', () => {
  it('preserves complete active state across complete process termination and rehydration', async () => {
    const sharedStorage = new MemoryStorageAdapter();

    // -----------------------------------------------------------------
    // PROCESS 1: Initial creation and active messaging
    // -----------------------------------------------------------------
    const v1 = new SpaceVaultManager();
    const envRecord = v1.createSpace({ name: 'Android Secure Space', password: 'MasterPass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    await v1.saveEnvelopeToStorage(envRecord, sharedStorage);

    const s1 = v1.unlockSpace('MasterPass123!', envRecord.spaceId);
    const store1 = new EncryptedSpaceStore(sharedStorage);
    await store1.loadPartitionFromStorage(s1);

    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    const bundle1 = pre1.createPrekeyBundle(s1);

    const profile1 = createSignedProfile(doc1.identityId, id1.signingPrivateKey, 'android_pro', 'Android Pro', 'mb_android_1', bundle1);
    await store1.setAsync(s1, 'veil:user:profile', profile1);

    const contacts1 = new ContactManager(store1);
    const reqMgr1 = new ContactRequestManager(store1, contacts1, idMgr1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);

    // Setup a peer contact
    await contacts1.addContactFromInvitation(s1, {
      version: 1,
      identityId: 'id_peer_android_99',
      name: 'Peer Contact',
      signingPublicKey: 'dummy_sign_pub',
      keyAgreementPublicKey: 'dummy_ka_pub',
      fingerprint: 'PEER-FP-1234',
      mailboxId: 'mb_peer_99',
      prekeyBundle: bundle1,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: 'dummy_sig',
    });

    // Send a message and store state
    const { storedMessage } = await conv1.encryptAndPackWireMessage(s1, bundle1, 'Message before process death');

    // -----------------------------------------------------------------
    // HARD PROCESS KILL
    // Complete memory wiped
    // -----------------------------------------------------------------
    const v2 = new SpaceVaultManager();
    await v2.loadEnvelopesFromStorage(sharedStorage);
    const s2 = v2.unlockSpace('MasterPass123!', envRecord.spaceId);

    const store2 = new EncryptedSpaceStore(sharedStorage);
    await store2.loadPartitionFromStorage(s2);

    const idMgr2 = new SpaceIdentityManager();
    const reloadedDoc = idMgr2.getPublicDocument(s2, store2);
    expect(reloadedDoc?.identityId).toBe(doc1.identityId);

    const reloadedProfile = await store2.getAsync<SignedProfileDocument>(s2, 'veil:user:profile');
    expect(reloadedProfile?.username).toBe('android_pro');

    const contacts2 = new ContactManager(store2);
    const peerContact = await contacts2.getContact(s2, 'id_peer_android_99');
    expect(peerContact).not.toBeNull();
    expect(peerContact?.name).toBe('Peer Contact');

    // Verify conversation continuity can continue immediately
    const pre2 = new PrekeyManager(store2, idMgr2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);

    const { storedMessage: nextMsg } = await conv2.encryptAndPackWireMessage(s2, bundle1, 'Message after rehydration');
    expect(nextMsg.text).toBe('Message after rehydration');
  });
});
