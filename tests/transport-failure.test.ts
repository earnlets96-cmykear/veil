import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { TransportClient } from '../src/transport/client.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxCapability } from '../src/transport/capability.ts';
import { createTransportEnvelope } from '../src/transport/envelope.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 3: Network Failure & Offline Resilience Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let server: MockTransportServer;
  let client: TransportClient;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    server = new MockTransportServer();
    client = new TransportClient({ adapter: server, store, maxRetries: 3 });
  });

  it('OFFLINE MODE: enqueues message in local encrypted outbox when server is offline', async () => {
    vault.createSpace({ name: 'Main', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');

    const capRecipient = generateMailboxCapability();
    const env = createTransportEnvelope({
      mailboxId: capRecipient.mailboxId,
      payload: 'PENDING_OFFLINE_PAYLOAD',
      sizeClass: 'SMALL',
    });

    // Simulate server offline
    server.simulateOffline = true;

    // Send while offline — must not throw unhandled exception or lose data
    const item = await client.sendEnvelope(session, env, capRecipient.mailboxId);
    expect(item.status).toBe('failed');
    expect(client.getOutboxItems(session).length).toBe(1);

    // Turn server back online and process outbox
    server.simulateOffline = false;
    await server.createMailbox(capRecipient.mailboxId, 'dummy-verifier');

    const flushRes = await client.processOutbox(session);
    expect(flushRes.sent).toBe(1);
    expect(client.getOutboxItems(session).length).toBe(0); // Acknowledged and removed
  });

  it('TIMEOUT RESILIENCE: retries on network timeout without corrupting local state', async () => {
    vault.createSpace({ name: 'Main', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');

    const capRecipient = generateMailboxCapability();
    await server.createMailbox(capRecipient.mailboxId, 'dummy-verifier');

    const env = createTransportEnvelope({
      mailboxId: capRecipient.mailboxId,
      payload: 'TIMEOUT_PAYLOAD',
      sizeClass: 'SMALL',
    });

    server.simulateTimeout = true;
    await client.sendEnvelope(session, env, capRecipient.mailboxId);

    const outboxItems = client.getOutboxItems(session);
    expect(outboxItems.length).toBe(1);
    expect(outboxItems[0].status).toBe('failed');
    expect(outboxItems[0].attempts).toBe(1);

    // Resolve timeout and retry
    server.simulateTimeout = false;
    await client.processOutbox(session);

    expect(client.getOutboxItems(session).length).toBe(0);
  });
});
