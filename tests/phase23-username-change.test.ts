import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Username Change & Identity Continuity Tests', () => {
  let server: RelayServer;
  let relayPort: number;
  let client: DirectoryClient;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const res = await server.start();
    relayPort = res.port;
    client = new DirectoryClient(`http://127.0.0.1:${relayPort}`);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('allows safe username update by identity owner while preserving cryptographic identity continuity', async () => {
    const vault = new SpaceVaultManager();
    const s = vault.unlockSpace('P!', vault.createSpace({ name: 'User', password: 'P!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(s, store);
    const id = idMgr.loadIdentity(s, store)!;
    const pre = new PrekeyManager(store, idMgr);
    pre.generateSignedPrekey(s);
    const bundle = pre.createPrekeyBundle(s);

    // 1. Initial registration: @original_name
    const profile1 = createSignedProfile(
      doc.identityId,
      id.signingPrivateKey,
      'original_name',
      'Original Name',
      'mb_user_123',
      bundle
    );
    await client.registerProfile(profile1);

    // Verify found at @original_name
    const found1 = await client.getProfileByUsername('original_name');
    expect(found1?.identityId).toBe(doc.identityId);

    // 2. User changes username to @new_name
    const profile2 = createSignedProfile(
      doc.identityId,
      id.signingPrivateKey,
      'new_name',
      'New Name',
      'mb_user_123',
      bundle
    );
    await client.updateProfile(profile2);

    // Verify found at @new_name with same identityId
    const found2 = await client.getProfileByUsername('new_name');
    expect(found2?.identityId).toBe(doc.identityId);
    expect(found2?.username).toBe('new_name');

    // Verify old username is released
    const oldFound = await client.getProfileByUsername('original_name');
    expect(oldFound).toBeNull();
  });
});
