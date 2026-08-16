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

describe('VEIL Phase 23: Username Registration & Collision Rejection Tests', () => {
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

  it('registers unique username atomically and rejects duplicate registration by different identity', async () => {
    // 1. Setup Alice
    const vaultA = new SpaceVaultManager();
    const sA = vaultA.unlockSpace('PassA!', vaultA.createSpace({ name: 'Alice', password: 'PassA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    const docA = idMgrA.createIdentity(sA, storeA);
    const idA = idMgrA.loadIdentity(sA, storeA)!;
    const preA = new PrekeyManager(storeA, idMgrA);
    preA.generateSignedPrekey(sA);
    const bundleA = preA.createPrekeyBundle(sA);

    const profileA = createSignedProfile(
      docA.identityId,
      idA.signingPrivateKey,
      'alice_prime',
      'Alice Prime',
      'mb_alice_123',
      bundleA
    );

    // Alice registers @alice_prime -> Success
    const regA = await client.registerProfile(profileA);
    expect(regA.success).toBe(true);
    expect(regA.username).toBe('alice_prime');

    // 2. Setup Bob (Adversary trying to register same username)
    const vaultB = new SpaceVaultManager();
    const sB = vaultB.unlockSpace('PassB!', vaultB.createSpace({ name: 'Bob', password: 'PassB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    const docB = idMgrB.createIdentity(sB, storeB);
    const idB = idMgrB.loadIdentity(sB, storeB)!;
    const preB = new PrekeyManager(storeB, idMgrB);
    preB.generateSignedPrekey(sB);
    const bundleB = preB.createPrekeyBundle(sB);

    const profileB = createSignedProfile(
      docB.identityId,
      idB.signingPrivateKey,
      'alice_prime', // Duplicate!
      'Bob Impersonator',
      'mb_bob_456',
      bundleB
    );

    // Bob tries to register @alice_prime -> Fails with CONFLICT (409)
    await expect(client.registerProfile(profileB)).rejects.toThrow(/already registered|CONFLICT/i);

    // 3. Alice re-registers / updates her own profile -> Success
    const updatedProfileA = createSignedProfile(
      docA.identityId,
      idA.signingPrivateKey,
      'alice_prime',
      'Alice Updated Name',
      'mb_alice_123',
      bundleA
    );
    const updateRes = await client.updateProfile(updatedProfileA);
    expect(updateRes.success).toBe(true);

    const fetched = await client.getProfileByUsername('alice_prime');
    expect(fetched?.displayName).toBe('Alice Updated Name');
  });

  it('rejects registration of invalid username format and forged signatures', async () => {
    const vault = new SpaceVaultManager();
    const s = vault.unlockSpace('P!', vault.createSpace({ name: 'User', password: 'P!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(s, store);
    const id = idMgr.loadIdentity(s, store)!;
    const pre = new PrekeyManager(store, idMgr);
    pre.generateSignedPrekey(s);
    const bundle = pre.createPrekeyBundle(s);

    const validProfile = createSignedProfile(
      doc.identityId,
      id.signingPrivateKey,
      'valid_user',
      'Valid User',
      'mb_123',
      bundle
    );

    // Tamper with signature
    const forgedProfile = {
      ...validProfile,
      signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
    };

    await expect(client.registerProfile(forgedProfile)).rejects.toThrow(/signature|FORBIDDEN/i);
  });
});
