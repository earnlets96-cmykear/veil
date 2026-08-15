import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 13: Duplicate Delivery Reconciliation Tests', () => {
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

  it('DUPLICATE RECONCILIATION: Ignores duplicate envelopes and prevents duplicate message delivery', async () => {
    const env = vault.createSpace({ name: 'Test Space', password: 'Pass123!Secure', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!Secure', env.spaceId);

    const queue = netManager.getQueue();

    const inbound1 = {
      queueId: 'q_01',
      spaceId: session.spaceId,
      mailboxId: 'mb_01',
      envelopeId: 'duplicate_envelope_id_100',
      payload: 'Ciphertext',
      status: 'QUEUED' as const,
      receivedAt: Date.now(),
    };

    const isFirstTime = await queue.enqueueInbound(session, inbound1);
    expect(isFirstTime).toBe(true);

    // Process it
    await queue.markInboundProcessed(session, 'q_01');

    // Attempt to enqueue the exact same envelope again
    const inbound2 = {
      queueId: 'q_02',
      spaceId: session.spaceId,
      mailboxId: 'mb_01',
      envelopeId: 'duplicate_envelope_id_100',
      payload: 'Ciphertext',
      status: 'QUEUED' as const,
      receivedAt: Date.now(),
    };

    const isSecondTime = await queue.enqueueInbound(session, inbound2);
    expect(isSecondTime).toBe(false); // Duplicate suppressed!
  });
});
