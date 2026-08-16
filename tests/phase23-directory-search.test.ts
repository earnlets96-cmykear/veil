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

describe('VEIL Phase 23: Directory Search & Prefix Matching Tests', () => {
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

  it('searches users by username substring and returns public-only fields', async () => {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const pre = new PrekeyManager(store, idMgr);

    // Register 3 users: phone1, phone2, alice
    const usernames = ['phone1_alpha', 'phone2_beta', 'alice_prime'];
    for (const u of usernames) {
      const s = vault.unlockSpace('P!', vault.createSpace({ name: u, password: 'P!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
      const doc = idMgr.createIdentity(s, store);
      const id = idMgr.loadIdentity(s, store)!;
      pre.generateSignedPrekey(s);
      const bundle = pre.createPrekeyBundle(s);

      const profile = createSignedProfile(
        doc.identityId,
        id.signingPrivateKey,
        u,
        `Display for ${u}`,
        `mb_${u}`,
        bundle
      );
      await client.registerProfile(profile);
    }

    // Search "phone"
    const phoneResults = await client.searchProfiles('phone');
    expect(phoneResults).toHaveLength(2);
    const foundUsernames = phoneResults.map((r) => r.username);
    expect(foundUsernames).toContain('phone1_alpha');
    expect(foundUsernames).toContain('phone2_beta');
    expect(foundUsernames).not.toContain('alice_prime');

    // Verify search results contain ONLY public fields
    for (const res of phoneResults) {
      expect(res.identityId).toBeDefined();
      expect(res.username).toBeDefined();
      expect(res.displayName).toBeDefined();
      expect(res.profileSignature).toBeDefined();

      // Crucial: generic search result should NOT leak mailboxId or prekey bundle
      expect((res as any).mailboxId).toBeUndefined();
      expect((res as any).prekeyBundle).toBeUndefined();
    }

    // Direct profile fetch by username DOES provide mailbox and prekey bundle for contact initiation
    const fullProfile = await client.getProfileByUsername('phone1_alpha');
    expect(fullProfile?.mailboxId).toBe('mb_phone1_alpha');
    expect(fullProfile?.prekeyBundle).toBeDefined();
  });
});
