import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, constantTimeEquals } from '../src/crypto/utils.ts';

describe('VEIL Phase 2: Cross-Space Identity Isolation', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('Main Identity ≠ Private Identity ≠ Decoy Identity', () => {
    vault.createSpace({ name: 'Main', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassPriv', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Decoy', password: 'PassDecoy', isDecoy: true, kdfParams: FAST_TEST_KDF_PARAMS });

    const mainSess = vault.unlockSpace('PassMain');
    const privSess = vault.unlockSpace('PassPriv');
    const decoySess = vault.unlockSpace('PassDecoy');

    const mainDoc = idMgr.createIdentity(mainSess, store);
    const privDoc = idMgr.createIdentity(privSess, store);
    const decoyDoc = idMgr.createIdentity(decoySess, store);

    // All signing keys must be distinct
    expect(mainDoc.signingPublicKey).not.toBe(privDoc.signingPublicKey);
    expect(mainDoc.signingPublicKey).not.toBe(decoyDoc.signingPublicKey);
    expect(privDoc.signingPublicKey).not.toBe(decoyDoc.signingPublicKey);

    // All KA keys must be distinct
    expect(mainDoc.keyAgreementPublicKey).not.toBe(privDoc.keyAgreementPublicKey);
    expect(mainDoc.keyAgreementPublicKey).not.toBe(decoyDoc.keyAgreementPublicKey);

    // All fingerprints must be distinct
    expect(mainDoc.fingerprint).not.toBe(privDoc.fingerprint);
    expect(mainDoc.fingerprint).not.toBe(decoyDoc.fingerprint);

    // All identity IDs must be distinct
    expect(mainDoc.identityId).not.toBe(privDoc.identityId);
    expect(mainDoc.identityId).not.toBe(decoyDoc.identityId);
  });

  it('CROSS-SPACE ATTACK: Private Space cannot read Main private identity material', () => {
    const mainEnv = vault.createSpace({ name: 'Main', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassPriv', kdfParams: FAST_TEST_KDF_PARAMS });

    const mainSess = vault.unlockSpace('PassMain');
    const privSess = vault.unlockSpace('PassPriv');

    idMgr.createIdentity(mainSess, store);

    // Private session trying to access Main's identity store partition
    // The store is partitioned by spaceId, and private's storage key can't decrypt main's records
    const rawMainPartition = store.getRawPartition(mainEnv.spaceId);
    expect(rawMainPartition).toBeDefined();

    // Private session cannot read Main's identity
    const privIdentity = idMgr.loadIdentity(privSess, store);
    expect(privIdentity).toBeNull(); // No identity in Private's partition
  });

  it('LOCKED SPACE: cannot access identity when Space is locked', () => {
    const env = vault.createSpace({ name: 'Main', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass1');
    idMgr.createIdentity(session, store);

    vault.lockSpace(env.spaceId);

    expect(() => idMgr.loadIdentity(session, store)).toThrow(/locked or destroyed/);
    expect(() => idMgr.createIdentity(session, store)).toThrow(/locked or destroyed/);
    expect(() => idMgr.signMessage(session, store, new Uint8Array([1, 2, 3]))).toThrow(/locked or destroyed/);
  });

  it('CROSS-SPACE SIGNING ATTACK: Main signing key cannot sign as Private', () => {
    vault.createSpace({ name: 'Main', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassPriv', kdfParams: FAST_TEST_KDF_PARAMS });

    const mainSess = vault.unlockSpace('PassMain');
    const privSess = vault.unlockSpace('PassPriv');

    const mainDoc = idMgr.createIdentity(mainSess, store);
    const privDoc = idMgr.createIdentity(privSess, store);

    // Main signs a message
    const message = new TextEncoder().encode('Signed by Main');
    const mainSig = idMgr.signMessage(mainSess, store, message);

    // Verify with Main's key — must succeed
    const mainPub = base64ToBytes(mainDoc.signingPublicKey);
    expect(idMgr.verifySignature(mainPub, message, mainSig)).toBe(true);

    // Verify with Private's key — MUST FAIL
    const privPub = base64ToBytes(privDoc.signingPublicKey);
    expect(idMgr.verifySignature(privPub, message, mainSig)).toBe(false);
  });
});
