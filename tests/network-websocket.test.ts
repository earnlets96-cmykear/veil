import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 13: WebSocket Real-Time Push & Delivery Tests', () => {
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

  it('WEBSOCKET REAL-TIME DELIVERY: Starts listening and receives instant push envelope', async () => {
    const envA = vault.createSpace({ name: 'Space A', password: 'PasswordA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'Space B', password: 'PasswordB456!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vault.unlockSpace('PasswordA123!', envA.spaceId);
    const sessionB = vault.unlockSpace('PasswordB456!', envB.spaceId);

    const mbB = await netManager.getOrCreateMailbox(sessionB);

    const receivedPayloads: string[] = [];
    const pushPromise = new Promise<void>((resolve) => {
      netManager.startListening(sessionB, async (payload) => {
        receivedPayloads.push(payload);
        resolve();
      });
    });

    // Client A sends message to B
    const ciphertext = Buffer.from('Real-time WebSocket Push from Alice').toString('base64');
    await netManager.sendEnvelope(sessionA, mbB.mailboxId, ciphertext);

    await pushPromise;
    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0]).toBe(ciphertext);

    netManager.stopListening(sessionB);
  });
});
