import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, constantTimeEquals } from '../src/crypto/utils.ts';
import type { IdentityDocument } from '../src/identity/document.ts';

describe('VEIL Phase 2: Identity Lifecycle Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('should persist and reload identity across lock/unlock cycles', () => {
    const env = vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session1 = vault.unlockSpace('Pass1');
    const doc1 = idMgr.createIdentity(session1, store);

    // Lock
    vault.lockSpace(env.spaceId);

    // Re-unlock and load
    const session2 = vault.unlockSpace('Pass1');
    const loaded = idMgr.loadIdentity(session2, store);

    expect(loaded).not.toBeNull();
    expect(loaded!.document.identityId).toBe(doc1.identityId);
    expect(loaded!.document.signingPublicKey).toBe(doc1.signingPublicKey);
    expect(loaded!.document.keyAgreementPublicKey).toBe(doc1.keyAgreementPublicKey);
    expect(loaded!.document.fingerprint).toBe(doc1.fingerprint);
    expect(loaded!.signingPrivateKey.length).toBe(32);
    expect(loaded!.keyAgreementPrivateKey.length).toBe(32);
  });

  it('LOCKED SESSION: identity is inaccessible when Space is locked', () => {
    const env = vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass1');
    idMgr.createIdentity(session, store);

    vault.lockSpace(env.spaceId);

    expect(() => idMgr.loadIdentity(session, store)).toThrow(/locked or destroyed/);
    expect(() => idMgr.getPublicDocument(session, store)).toThrow(/locked or destroyed/);
    expect(() => idMgr.signMessage(session, store, new Uint8Array([1]))).toThrow(/locked or destroyed/);
  });

  it('PASSWORD CHANGE: identity persists across password change', () => {
    const env = vault.createSpace({ name: 'Main', password: 'OldPass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session1 = vault.unlockSpace('OldPass');
    const doc1 = idMgr.createIdentity(session1, store);
    vault.lockSpace(env.spaceId);

    // Change password
    vault.changePassword(env.spaceId, 'OldPass', 'NewPass', FAST_TEST_KDF_PARAMS);

    // Unlock with new password
    const session2 = vault.unlockSpace('NewPass');
    const loaded = idMgr.loadIdentity(session2, store);

    expect(loaded).not.toBeNull();
    // Identity must be EXACTLY the same after password change
    expect(loaded!.document.identityId).toBe(doc1.identityId);
    expect(loaded!.document.signingPublicKey).toBe(doc1.signingPublicKey);
    expect(loaded!.document.keyAgreementPublicKey).toBe(doc1.keyAgreementPublicKey);
    expect(loaded!.document.fingerprint).toBe(doc1.fingerprint);
  });

  it('DELETION: deleting a Space removes identity material', () => {
    const env = vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass1');
    idMgr.createIdentity(session, store);

    // Delete Space
    store.purgePartition(env.spaceId);
    vault.deleteSpace(env.spaceId);

    expect(vault.getEnvelope(env.spaceId)).toBeUndefined();
    expect(store.getRawPartition(env.spaceId)).toBeUndefined();
  });

  it('should support SpaceIdentityManager.computeSharedSecret across Spaces', () => {
    vault.createSpace({ name: 'Alice', password: 'AlicePass', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'BobPass', kdfParams: FAST_TEST_KDF_PARAMS });

    const aliceSess = vault.unlockSpace('AlicePass');
    const bobSess = vault.unlockSpace('BobPass');

    const aliceDoc = idMgr.createIdentity(aliceSess, store);
    const bobDoc = idMgr.createIdentity(bobSess, store);

    const alicePeerPub = base64ToBytes(bobDoc.keyAgreementPublicKey);
    const bobPeerPub = base64ToBytes(aliceDoc.keyAgreementPublicKey);

    const ssAlice = idMgr.computeSharedSecret(aliceSess, store, alicePeerPub);
    const ssBob = idMgr.computeSharedSecret(bobSess, store, bobPeerPub);

    // DH commutativity: Alice(priv) + Bob(pub) == Bob(priv) + Alice(pub)
    expect(constantTimeEquals(ssAlice, ssBob)).toBe(true);
    expect(ssAlice.length).toBe(32);
  });

  it('hasIdentity returns correct state', () => {
    vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass1');

    expect(idMgr.hasIdentity(session, store)).toBe(false);
    idMgr.createIdentity(session, store);
    expect(idMgr.hasIdentity(session, store)).toBe(true);
  });
});
