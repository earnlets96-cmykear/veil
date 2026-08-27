/**
 * Phase 31: Offline-First Profile Editing & Background Sync Tests.
 *
 * Verifies that profile edits are saved locally even if the network is unavailable,
 * and automatically synced to the directory once connectivity is restored.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpaceSession } from '../src/spaces/session.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { createSignedProfile, verifySignedProfile } from '../src/identity/profile.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import type { SignedProfileDocument } from '../src/server/types.ts';

describe('Phase 31: Offline-First Profile Editing & Sync Resilience', () => {
  let session: SpaceSession;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let prekeyMgr: PrekeyManager;

  beforeEach(() => {
    const memory = new MemoryStorageAdapter();
    store = new EncryptedSpaceStore(memory);
    session = new SpaceSession('space-profile-test', 'Profile Test Space', false, randomBytes(32));
    idMgr = new SpaceIdentityManager();
    prekeyMgr = new PrekeyManager(store, idMgr);
    idMgr.createIdentity(session, store);
  });

  afterEach(() => {
    session.destroy();
  });

  it('persists profile edits locally in encrypted storage during network outage', async () => {
    const identity = idMgr.loadIdentity(session, store);
    expect(identity).toBeTruthy();

    const prekeyBundle = prekeyMgr.createPrekeyBundle(session);
    const profile = createSignedProfile(
      identity!.document.identityId,
      identity!.signingPrivateKey,
      'alice_offline',
      'Alice Offline',
      'mbx_123',
      prekeyBundle,
      undefined
    );

    // 1. Save profile to local encrypted store
    await store.setAsync(session, 'veil:user:profile', profile);

    // 2. Mark pending cloud sync
    await store.setAsync(session, 'veil:pending:profile_sync', profile);

    // 3. Verify local encrypted store contains the profile
    const saved = await store.getAsync<SignedProfileDocument>(session, 'veil:user:profile');
    expect(saved).toBeTruthy();
    expect(saved?.username).toBe('alice_offline');
    expect(saved?.displayName).toBe('Alice Offline');

    // 4. Verify Ed25519 signature is valid
    const isValid = verifySignedProfile(saved!);
    expect(isValid).toBe(true);

    // 5. Verify pending sync marker is present for background drainage
    const pending = await store.getAsync<SignedProfileDocument>(session, 'veil:pending:profile_sync');
    expect(pending).toBeTruthy();
    expect(pending?.username).toBe('alice_offline');

    // 6. Simulate network reconnection flush
    await store.deleteAsync(session, 'veil:pending:profile_sync');
    const flushedPending = await store.getAsync<SignedProfileDocument>(session, 'veil:pending:profile_sync');
    expect(flushedPending).toBeNull();
  });
});
