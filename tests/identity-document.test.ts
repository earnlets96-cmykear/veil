import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { verifyIdentityDocument, type IdentityDocument } from '../src/identity/document.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 2: Identity Document Verification', () => {
  function createTestIdentity(): IdentityDocument {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();
    vault.createSpace({ name: 'Test', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');
    return idMgr.createIdentity(session, store);
  }

  it('should accept a valid self-signed identity document', () => {
    const doc = createTestIdentity();
    expect(verifyIdentityDocument(doc)).toBe(true);
  });

  it('should reject an identity document with unknown version', () => {
    const doc = createTestIdentity();
    const tampered = { ...doc, version: 2 as any };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('should reject a document with modified signingPublicKey', () => {
    const doc = createTestIdentity();
    // Create another identity and substitute its signing key
    const otherDoc = createTestIdentity();
    const tampered = { ...doc, signingPublicKey: otherDoc.signingPublicKey };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('should reject a document with modified keyAgreementPublicKey', () => {
    const doc = createTestIdentity();
    const otherDoc = createTestIdentity();
    const tampered = { ...doc, keyAgreementPublicKey: otherDoc.keyAgreementPublicKey };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('should reject a document with modified identityId', () => {
    const doc = createTestIdentity();
    const tampered = { ...doc, identityId: 'aaaa' + doc.identityId.slice(4) };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('should reject a document with modified fingerprint', () => {
    const doc = createTestIdentity();
    const tampered = { ...doc, fingerprint: '00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000' };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('should reject a document with modified createdAt', () => {
    const doc = createTestIdentity();
    const tampered = { ...doc, createdAt: doc.createdAt + 1000 };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('should reject a document with modified signature', () => {
    const doc = createTestIdentity();
    // Corrupt internal bytes of the signature (not trailing Base64 padding)
    const sigBytes = base64ToBytes(doc.signature);
    sigBytes[10] ^= 0xFF;
    const tampered = { ...doc, signature: bytesToBase64(sigBytes) };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('should reject a document with missing fields', () => {
    const doc = createTestIdentity();
    const noSig = { ...doc } as any;
    delete noSig.signature;
    expect(verifyIdentityDocument(noSig)).toBe(false);

    const noId = { ...doc } as any;
    delete noId.identityId;
    expect(verifyIdentityDocument(noId)).toBe(false);
  });
});
