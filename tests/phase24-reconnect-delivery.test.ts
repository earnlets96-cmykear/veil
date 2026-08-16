import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Offline Queuing & Reconnection Delivery Invariants Tests', () => {
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

  it('queues messages offline, flushes upon reconnect, and recipient processes all messages exactly once', async () => {
    const offlineConfig = {
      httpUrl: 'http://127.0.0.1:59997',
      wsUrl: 'ws://127.0.0.1:59997/v1/ws',
    };
    const onlineConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Client 1 (Alice)
    const v1 = new SpaceVaultManager();
    const s1 = v1.unlockSpace('PA!', v1.createSpace({ name: 'Alice', password: 'PA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);

    // Client 2 (Bob)
    const v2 = new SpaceVaultManager();
    const s2 = v2.unlockSpace('PB!', v2.createSpace({ name: 'Bob', password: 'PB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    pre2.generateOneTimePrekeys(s2, 10);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const netOnlineB = new NetworkManager(store2, onlineConfig);
    const mb2 = await netOnlineB.getOrCreateMailbox(s2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);

    // Alice is offline and sends 5 messages to Bob
    const netOfflineA = new NetworkManager(store1, offlineConfig);
    const sentTexts: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const text = `Offline queued message #${i}`;
      sentTexts.push(text);
      const { wirePayloadBase64 } = await conv1.encryptAndPackWireMessage(s1, bundle2, text);
      await netOfflineA.sendEnvelope(s1, mb2.mailboxId, wirePayloadBase64);
    }

    const queue1 = netOfflineA.getQueue();
    const queuedOutbound = await queue1.listOutbound(s1);
    expect(queuedOutbound).toHaveLength(5);

    // Alice comes online and flushes outbound queue
    const netOnlineA = new NetworkManager(store1, onlineConfig);
    const flushedCount = await netOnlineA.flushOutboundQueue(s1);
    expect(flushedCount).toBe(5);

    // Bob syncs mailbox and receives all 5 messages in order
    const receivedTexts: string[] = [];
    await netOnlineB.syncMailbox(s2, async (wireBase64) => {
      const res = await conv2.processInboundWirePayload(s2, wireBase64);
      receivedTexts.push(res.storedMessage.text);
    });

    expect(receivedTexts).toEqual(sentTexts);

    // A second sync yields ZERO duplicates
    const duplicateTexts: string[] = [];
    await netOnlineB.syncMailbox(s2, async (wireBase64) => {
      const res = await conv2.processInboundWirePayload(s2, wireBase64);
      duplicateTexts.push(res.storedMessage.text);
    });
    expect(duplicateTexts).toHaveLength(0);
  });
});
