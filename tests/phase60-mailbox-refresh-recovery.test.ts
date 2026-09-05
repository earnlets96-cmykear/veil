import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';
import { unpadPayload } from '../src/transport/padding.ts';

function unpackWire(b64: string): any {
  const padded = base64ToBytes(b64);
  const unpadded = unpadPayload(padded);
  return JSON.parse(new TextDecoder().decode(unpadded));
}

describe('VEIL Phase 60: Double Ratchet Self-Healing & Outbound Queue Unblocking Tests', () => {
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

  it('retains initialX3DHHeader on outbound messages until recipient responds (nr > 0)', async () => {
    // Client 1 (Alice)
    const v1 = new SpaceVaultManager();
    const s1 = v1.unlockSpace('PA!', v1.createSpace({ name: 'Alice', password: 'PA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    idMgr1.createIdentity(s1, store1);
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);

    // Client 2 (Bob)
    const v2 = new SpaceVaultManager();
    const s2 = v2.unlockSpace('PB!', v2.createSpace({ name: 'Bob', password: 'PB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    idMgr2.createIdentity(s2, store2);
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    pre2.generateOneTimePrekeys(s2, 5);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);

    // Alice sends message 1
    const { wirePayloadBase64: msg1Base64 } = await conv1.encryptAndPackWireMessage(s1, bundle2, 'Hello Bob 1');
    const wire1 = unpackWire(msg1Base64);
    expect(wire1.ratchetMessage.header.x3dhHeader).toBeDefined();

    // Alice sends message 2 before receiving any reply from Bob
    const { wirePayloadBase64: msg2Base64 } = await conv1.encryptAndPackWireMessage(s1, bundle2, 'Hello Bob 2');
    const wire2 = unpackWire(msg2Base64);
    // Self-healing: x3dhHeader must still be attached
    expect(wire2.ratchetMessage.header.x3dhHeader).toBeDefined();
    expect(wire2.ratchetMessage.header.x3dhHeader.ephemeralPubKey).toBe(wire1.ratchetMessage.header.x3dhHeader.ephemeralPubKey);

    // Bob only receives message 1 first
    const bobRes1 = await conv2.processInboundWirePayload(s2, msg1Base64);
    expect(bobRes1.storedMessage.text).toBe('Hello Bob 1');

    // Bob receives message 2
    const bobRes2 = await conv2.processInboundWirePayload(s2, msg2Base64);
    expect(bobRes2.storedMessage.text).toBe('Hello Bob 2');

    // Now Bob replies to Alice
    const aliceDoc = idMgr1.getPublicDocument(s1, store1);
    const aliceBundle = pre1.createPrekeyBundle(s1);
    const { wirePayloadBase64: bobReplyBase64 } = await conv2.encryptAndPackWireMessage(s2, aliceBundle, 'Hi Alice from Bob');

    // Alice processes Bob's reply
    const aliceInboundRes = await conv1.processInboundWirePayload(s1, bobReplyBase64);
    expect(aliceInboundRes.storedMessage.text).toBe('Hi Alice from Bob');

    // Now Alice sends message 3: ratchet has advanced (nr > 0), x3dhHeader is no longer required
    const { wirePayloadBase64: msg3Base64 } = await conv1.encryptAndPackWireMessage(s1, bundle2, 'Hello Bob 3');
    const wire3 = unpackWire(msg3Base64);
    expect(wire3.ratchetMessage.header.x3dhHeader).toBeUndefined();

    // Bob can decrypt message 3 without x3dhHeader
    const bobRes3 = await conv2.processInboundWirePayload(s2, msg3Base64);
    expect(bobRes3.storedMessage.text).toBe('Hello Bob 3');
  });

  it('unblocks outbound queue when an expired/dead mailbox returns 404', async () => {
    const offlineConfig = {
      httpUrl: 'http://127.0.0.1:59997',
      wsUrl: 'ws://127.0.0.1:59997/v1/ws',
    };
    const onlineConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Client Alice with offline network manager
    const vA = new SpaceVaultManager();
    const sA = vA.unlockSpace('PA!', vA.createSpace({ name: 'Alice', password: 'PA!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const netOfflineA = new NetworkManager(storeA, offlineConfig);

    // Client Bob with online network manager and valid mailbox
    const vB = new SpaceVaultManager();
    const sB = vB.unlockSpace('PB!', vB.createSpace({ name: 'Bob', password: 'PB!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const netB = new NetworkManager(storeB, onlineConfig);
    const bobMailbox = await netB.getOrCreateMailbox(sB);

    // Alice queues message 1 to a completely bogus/non-existent mailbox while offline
    const deadMailboxId = 'dead_mailbox_does_not_exist_404';
    await netOfflineA.sendEnvelope(sA, deadMailboxId, 'ciphertext_for_dead_mailbox');

    // Alice queues message 2 to Bob's valid mailbox while offline
    await netOfflineA.sendEnvelope(sA, bobMailbox.mailboxId, 'ciphertext_for_valid_bob');

    const queue = netOfflineA.getQueue();
    const beforeFlush = await queue.listOutbound(sA);
    expect(beforeFlush).toHaveLength(2);

    // Alice comes online and flushes outbound queue
    // Previously, 404 caused a break; in the loop, freezing message 2 indefinitely.
    // Now, item 1 is marked FAILED, and item 2 is drained to SENT_TO_RELAY.
    const netOnlineA = new NetworkManager(storeA, onlineConfig);
    const flushedCount = await netOnlineA.flushOutboundQueue(sA);
    expect(flushedCount).toBe(1);

    const afterFlush = await queue.listOutbound(sA);
    const deadItem = afterFlush.find((i) => i.mailboxId === deadMailboxId);
    const validItem = afterFlush.find((i) => i.mailboxId === bobMailbox.mailboxId);

    expect(deadItem?.status).toBe('FAILED');
    // Valid item was dispatched to relay and removed from queue
    expect(validItem).toBeUndefined();

    // Verify Bob receives message 2 from the relay
    let receivedPayload: string | null = null;
    await netB.syncMailbox(sB, async (payload) => {
      receivedPayload = payload;
    });
    expect(receivedPayload).toBe('ciphertext_for_valid_bob');
  });
});
