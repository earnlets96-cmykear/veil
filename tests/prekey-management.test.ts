import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: Prekey Generation & Management Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let prekeyMgr: PrekeyManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    prekeyMgr = new PrekeyManager(store, idMgr);
  });

  it('should generate Signed Prekey with valid Ed25519 signature', () => {
    vault.createSpace({ name: 'Bob', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');
    const doc = idMgr.createIdentity(session, store);

    const spk = prekeyMgr.generateSignedPrekey(session, 101);
    expect(spk.id).toBe(101);
    expect(spk.publicKey).toBeTruthy();
    expect(spk.signature).toBeTruthy();

    // Verify signature using Bob's Ed25519 public key
    const bobSigningPub = base64ToBytes(doc.signingPublicKey);
    expect(PrekeyManager.verifySignedPrekey(bobSigningPub, spk)).toBe(true);
  });

  it('should generate and consume One-Time Prekeys safely', () => {
    vault.createSpace({ name: 'Bob', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');
    idMgr.createIdentity(session, store);

    const opks = prekeyMgr.generateOneTimePrekeys(session, 5);
    expect(opks.length).toBe(5);

    const firstOpkId = opks[0].id;
    const privKey = prekeyMgr.consumeOneTimePrekey(session, firstOpkId);
    expect(privKey).not.toBeNull();
    expect(privKey!.length).toBe(32);

    // Consuming second time MUST return null (one-time guarantee)
    const secondAttempt = prekeyMgr.consumeOneTimePrekey(session, firstOpkId);
    expect(secondAttempt).toBeNull();
  });

  it('should create complete PrekeyBundle for asynchronous session setup', () => {
    vault.createSpace({ name: 'Bob', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');
    idMgr.createIdentity(session, store);
    prekeyMgr.generateOneTimePrekeys(session, 3);

    const bundle = prekeyMgr.createPrekeyBundle(session);
    expect(bundle.version).toBe(1);
    expect(bundle.identityDocument).toBeTruthy();
    expect(bundle.signedPrekey).toBeTruthy();
    expect(bundle.oneTimePrekey).toBeTruthy();
    expect(bundle.oneTimePrekey!.id).toBeDefined();
  });
});
