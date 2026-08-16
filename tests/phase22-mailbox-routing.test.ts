import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: Mailbox Routing & Integrity Tests', () => {
  let server: RelayServer;
  let relayPort: number;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const res = await server.start();
    relayPort = res.port;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('generates distinct random mailboxes per Space and persists binding safely', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    const vault = new SpaceVaultManager();
    const envA = vault.createSpace({ name: 'Space A', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'Space B', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vault.unlockSpace('PassA123!', envA.spaceId);
    const sessionB = vault.unlockSpace('PassB123!', envB.spaceId);

    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const net = new NetworkManager(store, netConfig);

    const mbA = await net.getOrCreateMailbox(sessionA);
    const mbB = await net.getOrCreateMailbox(sessionB);

    expect(mbA.mailboxId).not.toBe(mbB.mailboxId);
    expect(mbA.capabilityToken).not.toBe(mbB.capabilityToken);

    // Re-loading from storage returns the same binding
    const reloadA = await net.getOrCreateMailbox(sessionA);
    expect(reloadA.mailboxId).toBe(mbA.mailboxId);
  });

  it('rejects dispatch to non-existent mailbox and fails closed safely into queue', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Sender Space', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', env.spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const net = new NetworkManager(store, netConfig);

    const nonExistentMailbox = 'non_existent_mailbox_64_chars_hex_deadbeefcafebabefeedface1234';
    const queued = await net.sendEnvelope(session, nonExistentMailbox, 'Test Ciphertext');

    expect(queued.status).toBe('QUEUED');
    expect(queued.errorMessage).toMatch(/404|not found/i);

    // Verify it is preserved in persistent queue
    const pending = await net.getQueue().listOutbound(session);
    expect(pending).toHaveLength(1);
    expect(pending[0].mailboxId).toBe(nonExistentMailbox);
  });
});
