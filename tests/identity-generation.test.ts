import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { verifyIdentityDocument } from '../src/identity/document.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { constantTimeEquals } from '../src/crypto/utils.ts';

describe('VEIL Phase 2: Identity Generation', () => {
  it('should generate a valid self-signed identity document from an unlocked Space', () => {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();

    vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass1');

    const doc = idMgr.createIdentity(session, store);

    expect(doc.version).toBe(1);
    expect(doc.identityId).toBeTruthy();
    expect(doc.signingPublicKey).toBeTruthy();
    expect(doc.keyAgreementPublicKey).toBeTruthy();
    expect(doc.fingerprint).toBeTruthy();
    expect(doc.signature).toBeTruthy();
    expect(typeof doc.createdAt).toBe('number');

    // Self-signature must verify
    expect(verifyIdentityDocument(doc)).toBe(true);
  });

  it('should separate public and private material — document contains no private keys', () => {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();

    vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass1');
    const doc = idMgr.createIdentity(session, store);

    const docStr = JSON.stringify(doc);
    // Must NOT contain any field named "privateKey" or "private"
    expect(docStr).not.toContain('privateKey');
    expect(docStr).not.toContain('PrivateKey');
    // Verify only expected fields exist
    const keys = Object.keys(doc);
    expect(keys).toEqual([
      'version', 'identityId', 'signingPublicKey',
      'keyAgreementPublicKey', 'fingerprint', 'createdAt', 'signature'
    ]);
  });

  it('should produce deterministic identity from the same SMK', () => {
    const vault = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore();
    const store2 = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();

    vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });

    // Create identity, lock, re-unlock, create again
    const session1 = vault.unlockSpace('Pass1');
    const doc1 = idMgr.createIdentity(session1, store1);
    vault.lockAll();

    const session2 = vault.unlockSpace('Pass1');
    const doc2 = idMgr.createIdentity(session2, store2);

    // Same SMK should produce same public keys and fingerprint
    expect(doc1.signingPublicKey).toBe(doc2.signingPublicKey);
    expect(doc1.keyAgreementPublicKey).toBe(doc2.keyAgreementPublicKey);
    expect(doc1.identityId).toBe(doc2.identityId);
    expect(doc1.fingerprint).toBe(doc2.fingerprint);
  });

  it('should produce DIFFERENT identities for different Spaces', () => {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();

    vault.createSpace({ name: 'Main', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vault.unlockSpace('PassA');
    const sessionB = vault.unlockSpace('PassB');

    const docA = idMgr.createIdentity(sessionA, store);
    const docB = idMgr.createIdentity(sessionB, store);

    expect(docA.signingPublicKey).not.toBe(docB.signingPublicKey);
    expect(docA.keyAgreementPublicKey).not.toBe(docB.keyAgreementPublicKey);
    expect(docA.identityId).not.toBe(docB.identityId);
    expect(docA.fingerprint).not.toBe(docB.fingerprint);
  });

  it('should reject identity creation on a locked session', () => {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();

    const env = vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass1');
    vault.lockSpace(env.spaceId);

    expect(() => idMgr.createIdentity(session, store)).toThrow(/locked or destroyed/);
  });
});
