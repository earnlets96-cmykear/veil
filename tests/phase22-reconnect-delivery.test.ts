import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: Offline Queuing & Reconnect Catch-Up Delivery Tests', () => {
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

  it('queues while sender is offline, flushes upon reconnect, and recipient catches up via sync', async () => {
    // Start sender with invalid port (simulating offline)
    const offlineNetConfig = {
      httpUrl: 'http://127.0.0.1:59999',
      wsUrl: 'ws://127.0.0.1:59999/v1/ws',
    };

    const onlineNetConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // 1. Setup Recipient (online)
    const vaultB = new SpaceVaultManager();
    const envB = vaultB.createSpace({ name: 'Bob', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionB = vaultB.unlockSpace('PassB123!', envB.spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    idMgrB.createIdentity(sessionB, storeB);
    const prekeysB = new PrekeyManager(storeB, idMgrB);
    prekeysB.generateSignedPrekey(sessionB);
    const bundleB = prekeysB.createPrekeyBundle(sessionB);
    const netB = new NetworkManager(storeB, onlineNetConfig);
    const mbB = await netB.getOrCreateMailbox(sessionB);
    const convB = new ConversationManager(storeB, idMgrB, prekeysB);

    // 2. Setup Sender (offline)
    const vaultA = new SpaceVaultManager();
    const envA = vaultA.createSpace({ name: 'Alice', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vaultA.unlockSpace('PassA123!', envA.spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    idMgrA.createIdentity(sessionA, storeA);
    const prekeysA = new PrekeyManager(storeA, idMgrA);
    const convA = new ConversationManager(storeA, idMgrA, prekeysA);
    const netA = new NetworkManager(storeA, offlineNetConfig);

    // 3. Alice attempts to send 3 messages while offline
    const msgs = ['Offline msg 1', 'Offline msg 2', 'Offline msg 3'];
    for (const msg of msgs) {
      const { wirePayloadBase64 } = await convA.encryptAndPackWireMessage(sessionA, bundleB, msg);
      const queued = await netA.sendEnvelope(sessionA, mbB.mailboxId, wirePayloadBase64);
      expect(queued.status).toBe('QUEUED');
    }

    // Verify 3 items pending in Alice's encrypted queue
    const pendingBefore = await netA.getQueue().listOutbound(sessionA);
    expect(pendingBefore).toHaveLength(3);

    // 4. Alice network restores -> updates config to live relay and flushes
    const liveNetA = new NetworkManager(storeA, onlineNetConfig);
    const flushedCount = await liveNetA.flushOutboundQueue(sessionA);
    expect(flushedCount).toBe(3);

    // Outbound queue is now empty
    const pendingAfter = await liveNetA.getQueue().listOutbound(sessionA);
    expect(pendingAfter).toHaveLength(0);

    // 5. Bob (Recipient) reconnects and syncs mailbox
    const receivedTexts: string[] = [];
    const processed = await netB.syncMailbox(sessionB, async (payload) => {
      const res = await convB.processInboundWirePayload(sessionB, payload);
      receivedTexts.push(res.storedMessage.text);
    });

    expect(processed).toBe(3);
    expect(receivedTexts).toEqual(msgs);

    // Relay mailbox is now empty
    const relayRemaining = await server.getStore().countEnvelopes(mbB.mailboxId);
    expect(relayRemaining).toBe(0);
  });
});
