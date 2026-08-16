import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { createSignedProfile, SignedProfileDocument } from '../src/identity/profile.ts';
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 23: Multi-Space Identity & Contact Request Isolation Tests', () => {
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

  it('maintains strict cryptographic isolation of usernames, contact requests, and profiles across 5 Spaces', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const net = new NetworkManager(store, netConfig);
    const pre = new PrekeyManager(store, idMgr);
    const contacts = new ContactManager(store);
    const reqMgr = new ContactRequestManager(store, contacts, idMgr, net);

    const spaceNames = ['Personal', 'Work', 'Finance', 'Secret', 'Decoy'];
    const sessions: SpaceSession[] = [];
    const profiles: SignedProfileDocument[] = [];

    for (let i = 0; i < 5; i++) {
      const s = vault.unlockSpace(`Pass${i}!`, vault.createSpace({ name: spaceNames[i], password: `Pass${i}!`, kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
      sessions.push(s);

      const doc = idMgr.createIdentity(s, store);
      const id = idMgr.loadIdentity(s, store)!;
      pre.generateSignedPrekey(s);
      const bundle = pre.createPrekeyBundle(s);
      const mb = await net.getOrCreateMailbox(s);

      const profile = createSignedProfile(
        doc.identityId,
        id.signingPrivateKey,
        `space_user_${i}`,
        `Space User ${i}`,
        mb.mailboxId,
        bundle
      );
      await client.registerProfile(profile);
      profiles.push(profile);
    }

    // Verify all 5 profiles are discoverable in directory
    for (let i = 0; i < 5; i++) {
      const found = await client.getProfileByUsername(`space_user_${i}`);
      expect(found?.username).toBe(`space_user_${i}`);
    }

    // Send request from Space 0 to Space 1
    await reqMgr.sendContactRequest(sessions[0], profiles[0], profiles[1], 'Personal to Work');

    // Space 0 has 1 outgoing request
    const reqs0 = await reqMgr.listRequests(sessions[0]);
    expect(reqs0).toHaveLength(1);
    expect(reqs0[0].peerUsername).toBe('space_user_1');

    // Spaces 2, 3, 4 have ZERO contact requests
    for (let i = 2; i < 5; i++) {
      const reqs = await reqMgr.listRequests(sessions[i]);
      expect(reqs).toHaveLength(0);
    }

    // Space 1 syncs and receives request
    await net.syncMailbox(sessions[1], async (payload) => {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'CONTACT_REQUEST') {
        await reqMgr.handleInboundRequest(sessions[1], parsed);
      }
    });

    const reqs1 = await reqMgr.listRequests(sessions[1]);
    expect(reqs1).toHaveLength(1);
    expect(reqs1[0].peerUsername).toBe('space_user_0');
  });
});
