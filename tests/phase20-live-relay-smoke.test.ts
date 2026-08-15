import { describe, it, expect } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 20: Live Relay Smoke Test Suite', () => {
  it('RELAY ENDPOINT VALIDATION: Verifies health and mailbox operations on live server instance', async () => {
    const server = new RelayServer({ port: 8790 });
    await server.start();

    try {
      const vault = new SpaceVaultManager();
      const env = vault.createSpace({ name: 'Smoke Space', password: 'SmokePassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
      const session = vault.unlockSpace('SmokePassword123!', env.spaceId);

      const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
      const net = new NetworkManager(store, {
        httpUrl: 'http://127.0.0.1:8790',
        wsUrl: 'ws://127.0.0.1:8790/v1/ws',
      });

      const mb = await net.getOrCreateMailbox(session);
      expect(mb.mailboxId).toBeDefined();
      expect(mb.capabilityToken).toBeDefined();

      const processedCount = await net.syncMailbox(session);
      expect(processedCount).toBe(0);
    } finally {
      await server.stop();
    }
  });
});
