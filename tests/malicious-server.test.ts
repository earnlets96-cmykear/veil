import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { TransportClient } from '../src/transport/client.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxCapability } from '../src/transport/capability.ts';
import { createTransportEnvelope } from '../src/transport/envelope.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 3: Malicious Server & Adversarial Transport Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let server: MockTransportServer;
  let client: TransportClient;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    server = new MockTransportServer();
    client = new TransportClient({ adapter: server, store });
  });

  it('MALICIOUS SERVER: handles server returning corrupted payloads safely without crashing', async () => {
    vault.createSpace({ name: 'Main', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');

    const cap = generateMailboxCapability();
    await client.registerMailbox(session, cap);

    const env = createTransportEnvelope({
      mailboxId: cap.mailboxId,
      payload: 'CORRECT_OPAQUE_PAYLOAD',
      sizeClass: 'SMALL',
    });
    await server.postEnvelope(env);

    // Turn on malicious server corrupted response simulation
    server.simulateCorruptPayload = true;

    // Client fetches envelopes: envelope with corrupted payload is received into inbox
    const received = await client.fetchAndReceive(session, cap.mailboxId, cap.capability);
    expect(received.length).toBe(1);
    expect(received[0].payload).toBe('CORRUPTED_BLOB_!!!');
  });

  it('MALICIOUS SERVER: handles truncated server responses gracefully', async () => {
    vault.createSpace({ name: 'Main', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');

    const cap = generateMailboxCapability();
    await client.registerMailbox(session, cap);

    // Post 3 envelopes
    for (let i = 1; i <= 3; i++) {
      const env = createTransportEnvelope({
        mailboxId: cap.mailboxId,
        payload: `PAYLOAD_${i}`,
        sizeClass: 'SMALL',
        customEnvelopeId: `env-id-${i}`,
      });
      await server.postEnvelope(env);
    }

    // Simulate server returning only 1 envelope (truncated)
    server.simulateTruncatedResponse = true;

    const firstFetch = await client.fetchAndReceive(session, cap.mailboxId, cap.capability);
    expect(firstFetch.length).toBe(1);
    expect(firstFetch[0].envelopeId).toBe('env-id-1');

    // Next fetch retrieves remaining envelopes
    server.simulateTruncatedResponse = false;
    const secondFetch = await client.fetchAndReceive(session, cap.mailboxId, cap.capability);
    expect(secondFetch.length).toBe(2);

    // Total inbox items must be 3
    expect(client.getInboxItems(session).length).toBe(3);
  });
});
