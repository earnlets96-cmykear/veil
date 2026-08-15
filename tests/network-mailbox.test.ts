import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 13: Client Mailbox Binding & Encrypted Capability Storage Tests', () => {
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

  it('MAILBOX PERSISTENCE: Allocates mailbox and persists binding encrypted under Space StorageKey', async () => {
    const env = vault.createSpace({
      name: 'Personal Space',
      password: 'Pass123!Secure',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const session = vault.unlockSpace('Pass123!Secure', env.spaceId);

    // Allocate mailbox binding
    const binding1 = await netManager.getOrCreateMailbox(session);
    expect(binding1.mailboxId).toHaveLength(64);
    expect(binding1.capabilityToken).toHaveLength(64);

    // Call again -> must return cached binding
    const binding2 = await netManager.getOrCreateMailbox(session);
    expect(binding2.mailboxId).toBe(binding1.mailboxId);
    expect(binding2.capabilityToken).toBe(binding1.capabilityToken);

    // Verify storage partition contains encrypted record
    const rawPartition = store.getRawPartition(session.spaceId);
    expect(rawPartition).toBeDefined();
    const rawBindingRecord = rawPartition!.get('net_mailbox_binding');
    expect(rawBindingRecord).toBeDefined();
    // Raw ciphertext must NOT contain plaintext capability token
    expect(rawBindingRecord!.ciphertext).not.toContain(binding1.capabilityToken);
  });
});
