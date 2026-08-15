import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 13: Multi-Space Network & Mailbox Isolation Tests', () => {
  let server: RelayServer;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let netManager: NetworkManager;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();

    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    netManager = new NetworkManager(store, {
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('10-SPACE NETWORK ISOLATION: 10 Spaces generate distinct mailboxes and maintain isolated network state', async () => {
    const spaceCount = 10;
    const sessions = [];
    const bindings = [];

    for (let i = 0; i < spaceCount; i++) {
      const password = `SpacePass${i}!Secret`;
      const env = vault.createSpace({
        name: `Space_${i}`,
        password,
        kdfParams: FAST_TEST_KDF_PARAMS,
      });
      const session = vault.unlockSpace(password, env.spaceId);
      sessions.push(session);

      const binding = await netManager.getOrCreateMailbox(session);
      bindings.push(binding);
    }

    // Verify all 10 mailboxes are cryptographically unique
    const mailboxIds = new Set(bindings.map(b => b.mailboxId));
    const capTokens = new Set(bindings.map(b => b.capabilityToken));
    expect(mailboxIds.size).toBe(spaceCount);
    expect(capTokens.size).toBe(spaceCount);

    // Cross-Space Isolation: Space 0 cannot read Space 1's mailbox binding
    const space0BindingInStore = await store.getAsync(sessions[0], 'net_mailbox_binding');
    expect(space0BindingInStore).toEqual(bindings[0]);
    expect(space0BindingInStore).not.toEqual(bindings[1]);
  });
});
