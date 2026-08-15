import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { verifyIdentityDocument, type IdentityDocument } from '../src/identity/document.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToBase64, base64ToBytes, randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 2: Identity Tampering & Substitution Attacks', () => {
  function createTestIdentity(): { doc: IdentityDocument; vault: SpaceVaultManager; store: EncryptedSpaceStore } {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();
    vault.createSpace({ name: 'Test', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');
    const doc = idMgr.createIdentity(session, store);
    return { doc, vault, store };
  }

  it('SUBSTITUTION: replacing signing key with another identity key is detected', () => {
    const { doc: docA } = createTestIdentity();
    const { doc: docB } = createTestIdentity();

    // Substitute A's signing key with B's
    const tampered: IdentityDocument = { ...docA, signingPublicKey: docB.signingPublicKey };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('SUBSTITUTION: replacing key agreement key with another identity key is detected', () => {
    const { doc: docA } = createTestIdentity();
    const { doc: docB } = createTestIdentity();

    const tampered: IdentityDocument = { ...docA, keyAgreementPublicKey: docB.keyAgreementPublicKey };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('SUBSTITUTION: swapping signing and key agreement keys is detected', () => {
    const { doc } = createTestIdentity();

    // Swap signing and KA public keys
    const tampered: IdentityDocument = {
      ...doc,
      signingPublicKey: doc.keyAgreementPublicKey,
      keyAgreementPublicKey: doc.signingPublicKey,
    };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('SUBSTITUTION: replacing identity document from one Space into another context is detected', () => {
    const { doc: docA } = createTestIdentity();
    const { doc: docB } = createTestIdentity();

    // Try to use A's signature with B's public keys
    const frankenDoc: IdentityDocument = {
      ...docB,
      signature: docA.signature,
    };
    expect(verifyIdentityDocument(frankenDoc)).toBe(false);
  });

  it('TAMPERING: single bit flip in signing public key invalidates document', () => {
    const { doc } = createTestIdentity();
    const sigPubBytes = base64ToBytes(doc.signingPublicKey);
    sigPubBytes[0] ^= 0x01;
    const tampered = { ...doc, signingPublicKey: bytesToBase64(sigPubBytes) };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('TAMPERING: single bit flip in signature invalidates document', () => {
    const { doc } = createTestIdentity();
    const sigBytes = base64ToBytes(doc.signature);
    sigBytes[10] ^= 0x01;
    const tampered = { ...doc, signature: bytesToBase64(sigBytes) };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });

  it('TAMPERING: modifying createdAt timestamp invalidates signature', () => {
    const { doc } = createTestIdentity();
    const tampered = { ...doc, createdAt: doc.createdAt - 1 };
    expect(verifyIdentityDocument(tampered)).toBe(false);
  });
});
