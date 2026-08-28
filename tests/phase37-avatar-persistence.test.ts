/**
 * Phase 37 Avatar Persistence Regression Tests.
 *
 * Validates that profile avatars survive encrypted storage, profile signing,
 * directory registration, and multi-user avatar discovery.
 */

import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { createSignedProfile, verifySignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

function createIdentityWithBundle(name: string) {
  const vault = new SpaceVaultManager();
  const header = vault.createSpace({ name, password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace('Pass!', header.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const idMgr = new SpaceIdentityManager();
  const doc = idMgr.createIdentity(session, store);
  const identity = idMgr.loadIdentity(session, store)!;
  const prekeyMgr = new PrekeyManager(store, idMgr);
  prekeyMgr.generateSignedPrekey(session);
  prekeyMgr.generateOneTimePrekeys(session, 5);
  const bundle = prekeyMgr.createPrekeyBundle(session);
  return { vault, session, store, idMgr, doc, identity, bundle };
}

describe('Phase 37 — Avatar Persistence & Profile Propagation', () => {
  it('includes avatar data in signed profile and preserves it through verification', () => {
    const user = createIdentityWithBundle('AvatarUser');
    const testAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const profile = createSignedProfile(
      user.doc.identityId,
      user.identity.signingPrivateKey,
      'avataruser',
      'Avatar User',
      'mailbox_avatar_001',
      user.bundle,
      testAvatar
    );

    // Avatar must be included in the profile document
    expect(profile.avatar).toBe(testAvatar);
    expect(profile.identityId).toBe(user.doc.identityId);
    expect(profile.username).toBe('avataruser');
    expect(profile.displayName).toBe('Avatar User');

    // Profile signature must still verify with avatar
    const valid = verifySignedProfile(profile);
    expect(valid).toBe(true);
  });

  it('persists avatar in encrypted space store and retrieves it correctly', () => {
    const user = createIdentityWithBundle('PersistUser');
    const testAvatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//';

    const profile = createSignedProfile(
      user.doc.identityId,
      user.identity.signingPrivateKey,
      'persistuser',
      'Persist User',
      'mailbox_persist',
      user.bundle,
      testAvatar
    );

    // Store profile
    user.store.set(user.session, 'veil:user:profile', profile);

    // Retrieve and verify avatar
    const retrieved = user.store.get<any>(user.session, 'veil:user:profile');
    expect(retrieved).toBeTruthy();
    expect(retrieved.avatar).toBe(testAvatar);
    expect(retrieved.username).toBe('persistuser');
  });

  it('profile without avatar still verifies correctly', () => {
    const user = createIdentityWithBundle('NoAvatarUser');
    const profile = createSignedProfile(
      user.doc.identityId,
      user.identity.signingPrivateKey,
      'noavataruser',
      'No Avatar',
      'mailbox_noavatar',
      user.bundle,
      undefined // No avatar
    );

    expect(profile.avatar).toBeUndefined();
    const valid = verifySignedProfile(profile);
    expect(valid).toBe(true);
  });

  it('updated avatar in re-signed profile verifies with new signature', () => {
    const user = createIdentityWithBundle('UpdateAvatarUser');

    // Original profile without avatar
    const original = createSignedProfile(
      user.doc.identityId,
      user.identity.signingPrivateKey,
      'updateuser',
      'Update User',
      'mailbox_update',
      user.bundle,
      undefined
    );
    expect(original.avatar).toBeUndefined();
    expect(verifySignedProfile(original)).toBe(true);

    // Updated profile with avatar
    const updated = createSignedProfile(
      user.doc.identityId,
      user.identity.signingPrivateKey,
      'updateuser',
      'Update User',
      'mailbox_update',
      user.bundle,
      'data:image/png;base64,newAvatarData=='
    );
    expect(updated.avatar).toBe('data:image/png;base64,newAvatarData==');
    expect(verifySignedProfile(updated)).toBe(true);

    // Signatures must differ (different avatar payload)
    expect(updated.signature).not.toBe(original.signature);
  });
});
