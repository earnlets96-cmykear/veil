import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: ACK-After-Persistence & Delivery Semantics Tests', () => {
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

  it('keeps envelope on relay until recipient safely persists and sends ACK', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    const vault = new SpaceVaultManager();
    const envA = vault.createSpace({ name: 'Sender', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'Recipient', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vault.unlockSpace('PassA123!', envA.spaceId);
    const sessionB = vault.unlockSpace('PassB123!', envB.spaceId);

    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());

    const netA = new NetworkManager(storeA, netConfig);
    const netB = new NetworkManager(storeB, netConfig);

    const mbB = await netB.getOrCreateMailbox(sessionB);

    // 1. Sender submits envelope
    const sent = await netA.sendEnvelope(sessionA, mbB.mailboxId, 'Opaque Payload 123');
    expect(sent.status).toBe('SENT_TO_RELAY');

    // 2. Relay holds envelope while Recipient is not yet synced
    const countBeforeSync = await server.getStore().countEnvelopes(mbB.mailboxId);
    expect(countBeforeSync).toBe(1);

    // 3. Recipient syncs, stores in local inbound queue, and ACKs
    let deliveredPayload = '';
    const processed = await netB.syncMailbox(sessionB, async (payload) => {
      deliveredPayload = payload;
    });

    expect(processed).toBe(1);
    expect(deliveredPayload).toBe('Opaque Payload 123');

    // 4. Relay envelope is now deleted following ACK
    const countAfterSync = await server.getStore().countEnvelopes(mbB.mailboxId);
    expect(countAfterSync).toBe(0);

    // 5. Deduplication registry in Recipient recognizes processed envelope
    const isDup = await netB.getQueue().isDuplicate(sessionB, 'env_processed_123');
    expect(isDup).toBe(false); // Envelope ID from sync was unique
  });

  it('handles duplicate delivery by ACKing immediately without duplicate processing', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Recipient Space', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', env.spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const net = new NetworkManager(store, netConfig);
    const mb = await net.getOrCreateMailbox(session);

    // Pre-populate inbound queue with envelopeId
    const queue = net.getQueue();
    await queue.enqueueInbound(session, {
      queueId: 'q_dup_1',
      spaceId: session.spaceId,
      mailboxId: mb.mailboxId,
      envelopeId: 'env_duplicate_123',
      payload: 'Duplicate Payload',
      status: 'PROCESSED',
      receivedAt: Date.now(),
    });
    await queue.markInboundProcessed(session, 'q_dup_1');

    // Directly insert duplicate into relay to simulate redelivery
    await server.getStore().saveEnvelope({
      protocolVersion: 'v1',
      envelopeId: 'env_duplicate_123',
      mailboxId: mb.mailboxId,
      payload: 'Duplicate Payload',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
      sizeBytes: 17,
    });

    let processCallCount = 0;
    await net.syncMailbox(session, async () => {
      processCallCount++;
    });

    // Duplicate was suppressed from application callback
    expect(processCallCount).toBe(0);

    // But was acknowledged and purged from relay
    const relayCount = await server.getStore().countEnvelopes(mb.mailboxId);
    expect(relayCount).toBe(0);
  });
});
