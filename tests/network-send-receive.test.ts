import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 13: Outbound & Inbound Messaging Pipeline Tests', () => {
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

  it('SEND & RECEIVE PIPELINE: Client A sends envelope -> Client B syncs and ACKs after processing', async () => {
    const envA = vault.createSpace({ name: 'Space A', password: 'PasswordA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'Space B', password: 'PasswordB456!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vault.unlockSpace('PasswordA123!', envA.spaceId);
    const sessionB = vault.unlockSpace('PasswordB456!', envB.spaceId);

    const mbB = await netManager.getOrCreateMailbox(sessionB);

    // Client A sends envelope to Mailbox B
    const ciphertext = Buffer.from('E2EE Ciphertext Payload for B').toString('base64');
    const sent = await netManager.sendEnvelope(sessionA, mbB.mailboxId, ciphertext);
    expect(sent.status).toBe('SENT_TO_RELAY');

    // Client B syncs mailbox
    const receivedPayloads: string[] = [];
    const processedCount = await netManager.syncMailbox(sessionB, async (payload) => {
      receivedPayloads.push(payload);
    });

    expect(processedCount).toBe(1);
    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0]).toBe(ciphertext);

    // Subsequent sync returns 0 (ACK confirmed)
    const emptyCount = await netManager.syncMailbox(sessionB);
    expect(emptyCount).toBe(0);
  });
});
