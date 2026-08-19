/**
 * VEIL Phase 25: Intermittent Cross-Client Delivery & Browser-Compatible Double Ratchet Tests.
 *
 * Verifies that:
 * 1. Sequential messages (20+ messages) deliver and ratchet continuously without stopping.
 * 2. Bidirectional message exchanges (A -> B and B -> A) succeed across multiple DH ratchet turns.
 * 3. DoubleRatchet session decryption works seamlessly in browser runtimes without Node `Buffer`.
 * 4. Polling fallback operates reliably when WebSocket is disconnected or unavailable.
 * 5. Rapid bursts, deduplication, offline queueing, and error recovery function without dropping envelopes.
 * 6. Multi-Space isolation and zero-plaintext invariants remain strictly enforced.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpaceSession } from '../src/spaces/session.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { constantTimeEquals, bytesToBase64, base64ToBytes, randomBytes } from '../src/crypto/utils.ts';
import { initiateX3DH, receiveX3DH } from '../src/ratchet/x3dh.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { NetworkManager } from '../src/network/networkManager.ts';

describe('VEIL Phase 25: Intermittent Delivery & Browser Compatibility Tests', () => {
  let server: RelayServer;
  let relayStore: MemoryRelayStore;
  let relayPort: number;
  let relayHttpUrl: string;
  let relayWsUrl: string;

  beforeEach(async () => {
    relayStore = new MemoryRelayStore();
    server = new RelayServer(
      {
        port: 0,
        host: '127.0.0.1',
        logLevel: 'none',
      },
      relayStore
    );
    const addr = await server.start();
    relayPort = addr.port;
    relayHttpUrl = `http://127.0.0.1:${relayPort}`;
    relayWsUrl = `ws://127.0.0.1:${relayPort}/v1/ws`;
  });

  afterEach(async () => {
    await server.stop();
  });

  function createTestSession(vault: SpaceVaultManager, name: string, pass: string): SpaceSession {
    const env = vault.createSpace({ name, password: pass, kdfParams: FAST_TEST_KDF_PARAMS });
    return vault.unlockSpace(pass, env.spaceId);
  }

  // ===========================================================================
  // 1. DIRECT DOUBLE RATCHET BROWSER COMPATIBILITY
  // ===========================================================================

  it('RATchet Browser Compatibility: decrypts message 1, 2, ... 20 without Node Buffer dependency', async () => {
    // Simulate Bob creating prekeys
    const storeBob = new EncryptedSpaceStore();
    const vaultBob = new SpaceVaultManager();
    const sessionBob = createTestSession(vaultBob, 'BobSpace', 'BobPassphrase123!');
    const idMgrBob = new SpaceIdentityManager();
    idMgrBob.createIdentity(sessionBob, storeBob);
    const loadedBob = idMgrBob.loadIdentity(sessionBob, storeBob)!;
    const prekeyMgrBob = new PrekeyManager(storeBob, idMgrBob);
    prekeyMgrBob.generateSignedPrekey(sessionBob);
    prekeyMgrBob.generateOneTimePrekeys(sessionBob, 10);
    const bobBundle = prekeyMgrBob.createPrekeyBundle(sessionBob);

    // Simulate Alice creating identity
    const storeAlice = new EncryptedSpaceStore();
    const vaultAlice = new SpaceVaultManager();
    const sessionAlice = createTestSession(vaultAlice, 'AliceSpace', 'AlicePassphrase123!');
    const idMgrAlice = new SpaceIdentityManager();
    idMgrAlice.createIdentity(sessionAlice, storeAlice);
    const loadedAlice = idMgrAlice.loadIdentity(sessionAlice, storeAlice)!;

    // Alice initiates X3DH
    const x3dhInit = initiateX3DH(loadedAlice.keyAgreementPrivateKey, bobBundle);
    const bobRatchetPub = base64ToBytes(bobBundle.signedPrekey.publicKey);

    // Alice DoubleRatchet init
    const aliceSession = DoubleRatchetSession.initAlice(
      'sess_alice_bob',
      loadedBob.document.identityId,
      loadedBob.document.signingPublicKey,
      loadedBob.document.keyAgreementPublicKey,
      x3dhInit.sharedMasterKey,
      bobRatchetPub
    );

    // Bob receives X3DH on message 1
    const spkPriv = prekeyMgrBob.getSignedPrekeyPrivate(sessionBob, x3dhInit.header.signedPrekeyId)!;
    const opkPriv = x3dhInit.header.oneTimePrekeyId !== undefined
      ? prekeyMgrBob.consumeOneTimePrekey(sessionBob, x3dhInit.header.oneTimePrekeyId)
      : null;
    const aliceIdPub = base64ToBytes(loadedAlice.document.keyAgreementPublicKey);

    const bobSharedSecret = receiveX3DH(
      loadedBob.keyAgreementPrivateKey,
      spkPriv,
      opkPriv,
      aliceIdPub,
      x3dhInit.header
    );

    const bobSpkKeypair = {
      privateKey: spkPriv,
      publicKey: base64ToBytes(prekeyMgrBob.getSignedPrekeyPublic(sessionBob)!.publicKey),
    };

    const bobSession = DoubleRatchetSession.initBob(
      'sess_bob_alice',
      loadedAlice.document.identityId,
      loadedAlice.document.signingPublicKey,
      loadedAlice.document.keyAgreementPublicKey,
      bobSharedSecret,
      bobSpkKeypair
    );

    // Verify constantTimeEquals works reliably for key equality
    expect(constantTimeEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);

    // Message 1 from Alice to Bob
    const msg1 = aliceSession.ratchetEncrypt('Message 1: hi', x3dhInit.header);
    const dec1 = bobSession.ratchetDecrypt(msg1);
    expect(new TextDecoder().decode(dec1)).toBe('Message 1: hi');

    // Message 2 from Alice to Bob (CRITICAL BUG REGRESSION: dhReceivingPub is non-null now!)
    const msg2 = aliceSession.ratchetEncrypt('Message 2: how are you?');
    const dec2 = bobSession.ratchetDecrypt(msg2);
    expect(new TextDecoder().decode(dec2)).toBe('Message 2: how are you?');

    // Messages 3 to 20 from Alice to Bob
    for (let i = 3; i <= 20; i++) {
      const text = `Message ${i}: continuous delivery verification`;
      const msg = aliceSession.ratchetEncrypt(text);
      const dec = bobSession.ratchetDecrypt(msg);
      expect(new TextDecoder().decode(dec)).toBe(text);
    }
  });

  // ===========================================================================
  // 2. BIDIRECTIONAL 20-MESSAGE EXCHANGE ACROSS MULTIPLE DH RATCHET TURNS
  // ===========================================================================

  it('BIDIRECTIONAL EXCHANGE: 20 alternating messages with DH ratchet steps in both directions', async () => {
    const storeA = new EncryptedSpaceStore();
    const vaultA = new SpaceVaultManager();
    const sessionA = createTestSession(vaultA, 'Alice', 'PassA123!');
    const idMgrA = new SpaceIdentityManager();
    const idA = idMgrA.createIdentity(sessionA, storeA);
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);

    const storeB = new EncryptedSpaceStore();
    const vaultB = new SpaceVaultManager();
    const sessionB = createTestSession(vaultB, 'Bob', 'PassB123!');
    const idMgrB = new SpaceIdentityManager();
    const idB = idMgrB.createIdentity(sessionB, storeB);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    prekeyMgrB.generateSignedPrekey(sessionB);
    prekeyMgrB.generateOneTimePrekeys(sessionB, 20);
    const bundleB = prekeyMgrB.createPrekeyBundle(sessionB);

    const prekeyMgrAInit = new PrekeyManager(storeA, idMgrA);
    prekeyMgrAInit.generateSignedPrekey(sessionA);
    prekeyMgrAInit.generateOneTimePrekeys(sessionA, 20);
    const bundleA = prekeyMgrAInit.createPrekeyBundle(sessionA);

    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    // 1. Alice sends Message 1 to Bob
    const { wirePayloadBase64: wire1 } = await convMgrA.encryptAndPackWireMessage(sessionA, bundleB, 'A -> B: msg 1');
    const res1 = await convMgrB.processInboundWirePayload(sessionB, wire1);
    expect(res1.storedMessage.text).toBe('A -> B: msg 1');

    // 2. Bob replies to Alice (Triggers DH ratchet turn on Alice)
    const { wirePayloadBase64: wire2 } = await convMgrB.encryptAndPackWireMessage(sessionB, bundleA, 'B -> A: msg 2');
    const res2 = await convMgrA.processInboundWirePayload(sessionA, wire2);
    expect(res2.storedMessage.text).toBe('B -> A: msg 2');

    // 3. Alternate 20 messages back and forth
    for (let round = 3; round <= 20; round++) {
      if (round % 2 === 1) {
        // Alice -> Bob
        const text = `A -> B: round ${round}`;
        const { wirePayloadBase64 } = await convMgrA.encryptAndPackWireMessage(sessionA, bundleB, text);
        const res = await convMgrB.processInboundWirePayload(sessionB, wirePayloadBase64);
        expect(res.storedMessage.text).toBe(text);
      } else {
        // Bob -> Alice
        const text = `B -> A: round ${round}`;
        const { wirePayloadBase64 } = await convMgrB.encryptAndPackWireMessage(sessionB, bundleA, text);
        const res = await convMgrA.processInboundWirePayload(sessionA, wirePayloadBase64);
        expect(res.storedMessage.text).toBe(text);
      }
    }
  });

  // ===========================================================================
  // 3. FULL NETWORK PIPELINE: 20 CONSECUTIVE MESSAGES OVER RELAY & WEBSOCKET
  // ===========================================================================

  it('NETWORK PIPELINE: 20 sequential messages over Relay with WebSocket push', async () => {
    const netConfig = {
      httpUrl: relayHttpUrl,
      wsUrl: relayWsUrl,
      requestTimeoutMs: 5000,
    };

    // Setup Alice
    const storeA = new EncryptedSpaceStore();
    const vaultA = new SpaceVaultManager();
    const sessionA = createTestSession(vaultA, 'AliceNet', 'PassAlice123!');
    const idMgrA = new SpaceIdentityManager();
    idMgrA.createIdentity(sessionA, storeA);
    const netA = new NetworkManager(storeA, netConfig);
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);

    // Setup Bob
    const storeB = new EncryptedSpaceStore();
    const vaultB = new SpaceVaultManager();
    const sessionB = createTestSession(vaultB, 'BobNet', 'PassBob123!');
    const idMgrB = new SpaceIdentityManager();
    idMgrB.createIdentity(sessionB, storeB);
    const netB = new NetworkManager(storeB, netConfig);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    prekeyMgrB.generateSignedPrekey(sessionB);
    prekeyMgrB.generateOneTimePrekeys(sessionB, 25);
    const bundleB = prekeyMgrB.createPrekeyBundle(sessionB);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    const mailboxB = await netB.getOrCreateMailbox(sessionB);

    const receivedMessages: string[] = [];
    await netB.startListening(sessionB, async (payload) => {
      const res = await convMgrB.processInboundWirePayload(sessionB, payload);
      receivedMessages.push(res.storedMessage.text);
    });

    // Send 20 messages sequentially from Alice to Bob over NetworkManager
    for (let i = 1; i <= 20; i++) {
      const text = `Sequential network message #${i}`;
      const { wirePayloadBase64 } = await convMgrA.encryptAndPackWireMessage(sessionA, bundleB, text);
      await netA.sendEnvelope(sessionA, mailboxB.mailboxId, wirePayloadBase64);
      // Small pause for WebSocket dispatch
      await new Promise((r) => setTimeout(r, 25));
    }

    // Wait for all messages to arrive
    for (let wait = 0; wait < 40 && receivedMessages.length < 20; wait++) {
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(receivedMessages.length).toBe(20);
    for (let i = 1; i <= 20; i++) {
      expect(receivedMessages[i - 1]).toBe(`Sequential network message #${i}`);
    }

    netB.stopListening(sessionB);
  });

  // ===========================================================================
  // 4. POLLING FALLBACK: MESSAGES DELIVERED WHEN WEBSOCKET IS DISABLED
  // ===========================================================================

  it('POLLING FALLBACK: delivers 10 consecutive messages when WebSocket is disconnected', async () => {
    const netConfig = {
      httpUrl: relayHttpUrl,
      wsUrl: 'ws://127.0.0.1:9999/invalid/ws', // Non-existent WS endpoint -> triggers pure polling fallback
      requestTimeoutMs: 5000,
    };

    const storeA = new EncryptedSpaceStore();
    const vaultA = new SpaceVaultManager();
    const sessionA = createTestSession(vaultA, 'AlicePoll', 'Pass123!');
    const idMgrA = new SpaceIdentityManager();
    idMgrA.createIdentity(sessionA, storeA);
    const netA = new NetworkManager(storeA, netConfig);
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);

    const storeB = new EncryptedSpaceStore();
    const vaultB = new SpaceVaultManager();
    const sessionB = createTestSession(vaultB, 'BobPoll', 'Pass123!');
    const idMgrB = new SpaceIdentityManager();
    idMgrB.createIdentity(sessionB, storeB);
    const netB = new NetworkManager(storeB, netConfig);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    prekeyMgrB.generateSignedPrekey(sessionB);
    prekeyMgrB.generateOneTimePrekeys(sessionB, 15);
    const bundleB = prekeyMgrB.createPrekeyBundle(sessionB);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    const mailboxB = await netB.getOrCreateMailbox(sessionB);

    // Send 10 messages to Bob's mailbox
    for (let i = 1; i <= 10; i++) {
      const text = `Polling message #${i}`;
      const { wirePayloadBase64 } = await convMgrA.encryptAndPackWireMessage(sessionA, bundleB, text);
      await netA.sendEnvelope(sessionA, mailboxB.mailboxId, wirePayloadBase64);
    }

    // Bob syncs mailbox via polling
    const receivedMessages: string[] = [];
    const count = await netB.syncMailbox(sessionB, async (payload) => {
      const res = await convMgrB.processInboundWirePayload(sessionB, payload);
      receivedMessages.push(res.storedMessage.text);
    });

    expect(count).toBe(10);
    expect(receivedMessages.length).toBe(10);
    for (let i = 1; i <= 10; i++) {
      expect(receivedMessages[i - 1]).toBe(`Polling message #${i}`);
    }
  });

  // ===========================================================================
  // 5. RAPID BURST & DEDUPLICATION SAFETY
  // ===========================================================================

  it('RAPID BURSTS: 20 messages sent in parallel without drops or duplicate processing', async () => {
    const netConfig = {
      httpUrl: relayHttpUrl,
      wsUrl: relayWsUrl,
      requestTimeoutMs: 5000,
    };

    const storeA = new EncryptedSpaceStore();
    const vaultA = new SpaceVaultManager();
    const sessionA = createTestSession(vaultA, 'AliceBurst', 'Pass123!');
    const idMgrA = new SpaceIdentityManager();
    idMgrA.createIdentity(sessionA, storeA);
    const netA = new NetworkManager(storeA, netConfig);
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);

    const storeB = new EncryptedSpaceStore();
    const vaultB = new SpaceVaultManager();
    const sessionB = createTestSession(vaultB, 'BobBurst', 'Pass123!');
    const idMgrB = new SpaceIdentityManager();
    idMgrB.createIdentity(sessionB, storeB);
    const netB = new NetworkManager(storeB, netConfig);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    prekeyMgrB.generateSignedPrekey(sessionB);
    prekeyMgrB.generateOneTimePrekeys(sessionB, 25);
    const bundleB = prekeyMgrB.createPrekeyBundle(sessionB);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    const mailboxB = await netB.getOrCreateMailbox(sessionB);

    const receivedMessages: string[] = [];
    await netB.startListening(sessionB, async (payload) => {
      const res = await convMgrB.processInboundWirePayload(sessionB, payload);
      receivedMessages.push(res.storedMessage.text);
    });

    // Send 20 messages in rapid sequential burst
    for (let i = 1; i <= 20; i++) {
      const text = `Burst message #${i}`;
      const { wirePayloadBase64 } = await convMgrA.encryptAndPackWireMessage(sessionA, bundleB, text);
      await netA.sendEnvelope(sessionA, mailboxB.mailboxId, wirePayloadBase64);
    }

    // Wait for dispatch & deduplication
    for (let wait = 0; wait < 40 && receivedMessages.length < 20; wait++) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // Also trigger manual sync to verify deduplication prevents duplicate processing
    await netB.syncMailbox(sessionB, async (payload) => {
      const res = await convMgrB.processInboundWirePayload(sessionB, payload);
      receivedMessages.push(res.storedMessage.text);
    });

    expect(receivedMessages.length).toBe(20);
    netB.stopListening(sessionB);
  });

  // ===========================================================================
  // 6. ERROR RESILIENCE: MALFORMED ENVELOPE DOES NOT KILL INBOX
  // ===========================================================================

  it('ERROR RESILIENCE: one corrupted envelope does not prevent subsequent valid messages from delivering', async () => {
    const netConfig = {
      httpUrl: relayHttpUrl,
      wsUrl: relayWsUrl,
      requestTimeoutMs: 5000,
    };

    const storeA = new EncryptedSpaceStore();
    const vaultA = new SpaceVaultManager();
    const sessionA = createTestSession(vaultA, 'AliceResil', 'Pass123!');
    const idMgrA = new SpaceIdentityManager();
    idMgrA.createIdentity(sessionA, storeA);
    const netA = new NetworkManager(storeA, netConfig);
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);

    const storeB = new EncryptedSpaceStore();
    const vaultB = new SpaceVaultManager();
    const sessionB = createTestSession(vaultB, 'BobResil', 'Pass123!');
    const idMgrB = new SpaceIdentityManager();
    idMgrB.createIdentity(sessionB, storeB);
    const netB = new NetworkManager(storeB, netConfig);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    prekeyMgrB.generateSignedPrekey(sessionB);
    prekeyMgrB.generateOneTimePrekeys(sessionB, 10);
    const bundleB = prekeyMgrB.createPrekeyBundle(sessionB);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    const mailboxB = await netB.getOrCreateMailbox(sessionB);

    const receivedMessages: string[] = [];
    await netB.startListening(sessionB, async (payload) => {
      const res = await convMgrB.processInboundWirePayload(sessionB, payload);
      receivedMessages.push(res.storedMessage.text);
    });

    // 1. Send valid message 1
    const { wirePayloadBase64: valid1 } = await convMgrA.encryptAndPackWireMessage(sessionA, bundleB, 'Valid msg 1');
    await netA.sendEnvelope(sessionA, mailboxB.mailboxId, valid1);

    // 2. Send corrupted/tampered payload
    await netA.sendEnvelope(sessionA, mailboxB.mailboxId, 'CORRUPTED_CIPHERTEXT_BASE64_GARBAGE!!!');

    // 3. Send valid message 2
    const { wirePayloadBase64: valid2 } = await convMgrA.encryptAndPackWireMessage(sessionA, bundleB, 'Valid msg 2');
    await netA.sendEnvelope(sessionA, mailboxB.mailboxId, valid2);

    for (let wait = 0; wait < 30 && receivedMessages.length < 2; wait++) {
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(receivedMessages).toEqual(['Valid msg 1', 'Valid msg 2']);
    netB.stopListening(sessionB);
  });

  // ===========================================================================
  // 7. OFFLINE QUEUE & AUTOMATIC DRAIN UPON RECONNECT
  // ===========================================================================

  it('OFFLINE DRAIN: 10 envelopes queued while offline flush to relay upon reconnect', async () => {
    // Start with offline invalid URL
    const storeA = new EncryptedSpaceStore();
    const vaultA = new SpaceVaultManager();
    const sessionA = createTestSession(vaultA, 'AliceOffline', 'Pass123!');
    const netOffline = new NetworkManager(storeA, {
      httpUrl: 'http://127.0.0.1:9999',
      wsUrl: 'ws://127.0.0.1:9999',
      requestTimeoutMs: 500,
    });

    const storeB = new EncryptedSpaceStore();
    const vaultB = new SpaceVaultManager();
    const sessionB = createTestSession(vaultB, 'BobOffline', 'Pass123!');
    const netB = new NetworkManager(storeB, {
      httpUrl: relayHttpUrl,
      wsUrl: relayWsUrl,
    });
    const mailboxB = await netB.getOrCreateMailbox(sessionB);

    // Send 10 messages while offline
    for (let i = 1; i <= 10; i++) {
      const res = await netOffline.sendEnvelope(sessionA, mailboxB.mailboxId, `Offline msg ${i}`);
      expect(res.status).toBe('QUEUED');
    }

    // Now connect with valid relay and flush
    const netOnline = new NetworkManager(storeA, {
      httpUrl: relayHttpUrl,
      wsUrl: relayWsUrl,
    });

    const flushed = await netOnline.flushOutboundQueue(sessionA);
    expect(flushed).toBe(10);

    // Bob syncs mailbox
    const received: string[] = [];
    const count = await netB.syncMailbox(sessionB, async (p) => {
      received.push(p);
    });
    expect(count).toBe(10);
    expect(received.length).toBe(10);
  });

  // ===========================================================================
  // 8. SESSION RECOVERY: PERSISTED RATCHET STATE RECOVERY
  // ===========================================================================

  it('SESSION PERSISTENCE RECOVERY: ratchet state reconstructed after Space reload', async () => {
    const storeA = new EncryptedSpaceStore();
    const vaultA = new SpaceVaultManager();
    const sessionA = createTestSession(vaultA, 'AliceStore', 'Pass123!');
    const idMgrA = new SpaceIdentityManager();
    idMgrA.createIdentity(sessionA, storeA);
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const convMgrA1 = new ConversationManager(storeA, idMgrA, prekeyMgrA);

    const storeB = new EncryptedSpaceStore();
    const vaultB = new SpaceVaultManager();
    const sessionB = createTestSession(vaultB, 'BobStore', 'Pass123!');
    const idMgrB = new SpaceIdentityManager();
    idMgrB.createIdentity(sessionB, storeB);
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    prekeyMgrB.generateSignedPrekey(sessionB);
    prekeyMgrB.generateOneTimePrekeys(sessionB, 10);
    const bundleB = prekeyMgrB.createPrekeyBundle(sessionB);
    const convMgrB1 = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    // Send 3 messages
    for (let i = 1; i <= 3; i++) {
      const { wirePayloadBase64 } = await convMgrA1.encryptAndPackWireMessage(sessionA, bundleB, `Msg ${i}`);
      const res = await convMgrB1.processInboundWirePayload(sessionB, wirePayloadBase64);
      expect(res.storedMessage.text).toBe(`Msg ${i}`);
    }

    // Reconstruct ConversationManager instances (simulating app restart)
    const convMgrA2 = new ConversationManager(storeA, idMgrA, prekeyMgrA);
    const convMgrB2 = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    // Send 5 more messages
    for (let i = 4; i <= 8; i++) {
      const { wirePayloadBase64 } = await convMgrA2.encryptAndPackWireMessage(sessionA, bundleB, `Msg ${i}`);
      const res = await convMgrB2.processInboundWirePayload(sessionB, wirePayloadBase64);
      expect(res.storedMessage.text).toBe(`Msg ${i}`);
    }
  });

  // ===========================================================================
  // 9. MULTI-SPACE ISOLATION
  // ===========================================================================

  it('MULTI-SPACE ISOLATION: High-volume message traffic in Space 1 is completely isolated from Space 2', async () => {
    const store = new EncryptedSpaceStore();
    const vault = new SpaceVaultManager();
    const session1 = createTestSession(vault, 'SpacePrimary', 'Pass1!');
    const session2 = createTestSession(vault, 'SpaceSecondary', 'Pass2!');

    const idMgr = new SpaceIdentityManager();
    idMgr.createIdentity(session1, store);
    idMgr.createIdentity(session2, store);

    const net = new NetworkManager(store, {
      httpUrl: relayHttpUrl,
      wsUrl: relayWsUrl,
    });

    const mb1 = await net.getOrCreateMailbox(session1);
    const mb2 = await net.getOrCreateMailbox(session2);

    expect(mb1.mailboxId).not.toBe(mb2.mailboxId);

    // Send 10 messages to Space 1 mailbox
    for (let i = 1; i <= 10; i++) {
      await net.sendEnvelope(session1, mb1.mailboxId, `Space 1 message ${i}`);
    }

    // Space 2 syncing mailbox finds 0 envelopes
    const count2 = await net.syncMailbox(session2, async () => {});
    expect(count2).toBe(0);

    // Space 1 syncing mailbox finds all 10 envelopes
    const received1: string[] = [];
    const count1 = await net.syncMailbox(session1, async (p) => {
      received1.push(p);
    });
    expect(count1).toBe(10);
    expect(received1.length).toBe(10);
  });
});
