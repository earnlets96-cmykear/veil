import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { createSignedProfile, verifySignedProfile, canonicalizeProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Profile Signing & Tamper Resistance Tests', () => {
  it('creates deterministically signed profiles and verifies authentic signatures', () => {
    const vault = new SpaceVaultManager();
    const s = vault.unlockSpace('Pass!', vault.createSpace({ name: 'Signer', password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(s, store);
    const id = idMgr.loadIdentity(s, store)!;
    const pre = new PrekeyManager(store, idMgr);
    pre.generateSignedPrekey(s);
    pre.generateOneTimePrekeys(s, 5);
    const bundle = pre.createPrekeyBundle(s);

    const profile = createSignedProfile(
      doc.identityId,
      id.signingPrivateKey,
      'signer_user',
      'Signer Display',
      'mb_signer_123',
      bundle
    );

    expect(verifySignedProfile(profile)).toBe(true);
  });

  it('rejects profile if any security-sensitive field is tampered with', () => {
    const vault = new SpaceVaultManager();
    const s = vault.unlockSpace('Pass!', vault.createSpace({ name: 'Signer', password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(s, store);
    const id = idMgr.loadIdentity(s, store)!;
    const pre = new PrekeyManager(store, idMgr);
    pre.generateSignedPrekey(s);
    const bundle = pre.createPrekeyBundle(s);

    const profile = createSignedProfile(
      doc.identityId,
      id.signingPrivateKey,
      'alice_user',
      'Alice Original',
      'mb_alice_real',
      bundle
    );

    // Tampering 1: modified mailboxId
    expect(verifySignedProfile({ ...profile, mailboxId: 'mb_attacker_injected' })).toBe(false);

    // Tampering 2: modified username
    expect(verifySignedProfile({ ...profile, username: 'bob_user' })).toBe(false);

    // Tampering 3: modified displayName
    expect(verifySignedProfile({ ...profile, displayName: 'Impostor' })).toBe(false);

    // Tampering 4: modified identityId
    expect(verifySignedProfile({ ...profile, identityId: 'id_attacker_123' })).toBe(false);

    // Tampering 5: modified prekeyBundle public key
    const tamperedBundle = {
      ...bundle,
      signedPrekey: { ...bundle.signedPrekey, publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
    };
    expect(verifySignedProfile({ ...profile, prekeyBundle: tamperedBundle })).toBe(false);
  });

  it('rejects expired signed profiles fail-closed', () => {
    const vault = new SpaceVaultManager();
    const s = vault.unlockSpace('Pass!', vault.createSpace({ name: 'Signer', password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(s, store);
    const id = idMgr.loadIdentity(s, store)!;
    const pre = new PrekeyManager(store, idMgr);
    pre.generateSignedPrekey(s);
    const bundle = pre.createPrekeyBundle(s);

    // Create profile with negative expiration (already expired)
    const profile = createSignedProfile(
      doc.identityId,
      id.signingPrivateKey,
      'expired_user',
      'Expired User',
      'mb_123',
      bundle,
      undefined,
      -10 // Expired 10 seconds ago
    );

    expect(verifySignedProfile(profile)).toBe(false);
  });
});
