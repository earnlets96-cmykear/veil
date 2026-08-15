import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { TransportClient } from '../src/transport/client.ts';
import { generateMailboxCapability } from '../src/transport/capability.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';


describe('VEIL Phase 13: Full End-to-End E2EE Client ↔ Relay Network Integration Test', () => {
  let server: RelayServer;
  let vault: SpaceVaultManager;
  let storeAlice: EncryptedSpaceStore;
  let storeBob: EncryptedSpaceStore;
  let netManagerAlice: NetworkManager;
  let netManagerBob: NetworkManager;
  let idMgr: SpaceIdentityManager;
  let convAlice: ConversationManager;
  let convBob: ConversationManager;
  let mockServer: MockTransportServer;
  let mockTransportAlice: TransportClient;
  let mockTransportBob: TransportClient;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();

    vault = new SpaceVaultManager();
    storeAlice = new EncryptedSpaceStore();
    storeBob = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();

    mockServer = new MockTransportServer();
    mockTransportAlice = new TransportClient({ adapter: mockServer, store: storeAlice });
    mockTransportBob = new TransportClient({ adapter: mockServer, store: storeBob });

    const prekeyMgrAlice = new PrekeyManager(storeAlice, idMgr);
    const prekeyMgrBob = new PrekeyManager(storeBob, idMgr);

    convAlice = new ConversationManager(storeAlice, idMgr, prekeyMgrAlice, mockTransportAlice);
    convBob = new ConversationManager(storeBob, idMgr, prekeyMgrBob, mockTransportBob);

    netManagerAlice = new NetworkManager(storeAlice, {
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });

    netManagerBob = new NetworkManager(storeBob, {
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('FULL E2EE LIFECYCLE OVER RELAY: Alice encrypts -> Relay transports -> Bob receives -> Bob decrypts -> Bob ACKs -> Bob replies', async () => {
    // 1. Create Spaces for Alice (Space A) and Bob (Space B)
    const envAlice = vault.createSpace({ name: 'Alice Space', password: 'PasswordA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const envBob = vault.createSpace({ name: 'Bob Space', password: 'PasswordB456!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionAlice = vault.unlockSpace('PasswordA123!', envAlice.spaceId);
    const sessionBob = vault.unlockSpace('PasswordB456!', envBob.spaceId);

    // 2. Generate Cryptographic Identities
    const docAlice = idMgr.createIdentity(sessionAlice, storeAlice);
    const docBob = idMgr.createIdentity(sessionBob, storeBob);

    // 3. Setup Prekey Bundles
    const prekeyMgrAlice = new PrekeyManager(storeAlice, idMgr);
    prekeyMgrAlice.generateOneTimePrekeys(sessionAlice, 5);
    const aliceBundle = prekeyMgrAlice.createPrekeyBundle(sessionAlice);

    const prekeyMgrBob = new PrekeyManager(storeBob, idMgr);
    prekeyMgrBob.generateOneTimePrekeys(sessionBob, 5);
    const bobBundle = prekeyMgrBob.createPrekeyBundle(sessionBob);

    // 4. Allocate Relay Mailboxes
    const mbAlice = await netManagerAlice.getOrCreateMailbox(sessionAlice);
    const mbBob = await netManagerBob.getOrCreateMailbox(sessionBob);

    const capBob = generateMailboxCapability();
    await mockTransportBob.registerMailbox(sessionBob, capBob);
    const capAlice = generateMailboxCapability();
    await mockTransportAlice.registerMailbox(sessionAlice, capAlice);

    // 5. Alice creates E2EE message via ConversationManager
    const originalPlaintext = 'Hello from VEIL (Real E2EE Network Transport)';
    await convAlice.sendMessage(sessionAlice, bobBundle, capBob.mailboxId, originalPlaintext);

    // Retrieve the envelope from mockServer
    const fetchedEnvs = await mockServer.fetchEnvelopes(capBob.mailboxId, capBob.capability);
    expect(fetchedEnvs).toHaveLength(1);
    const transportPayload = fetchedEnvs[0].payload;


    // 6. NetworkManager sends the encrypted payload over Phase 12 Relay Server
    const sentItem = await netManagerAlice.sendEnvelope(sessionAlice, mbBob.mailboxId, transportPayload);
    expect(sentItem.status).toBe('SENT_TO_RELAY');

    // 7. Verify Relay stored opaque payload without plaintext
    const relayEnvs = await server.getStore().listEnvelopes(mbBob.mailboxId, 10);
    expect(relayEnvs).toHaveLength(1);
    expect(relayEnvs[0].payload).not.toContain(originalPlaintext);

    // 8. Bob syncs mailbox from relay, decrypts via ConversationManager, and verifies plaintext
    let bobDecryptedText = '';
    const processedCount = await netManagerBob.syncMailbox(sessionBob, async (payload) => {
      const receivedMsg = convBob.receiveMessage(sessionBob, docAlice, payload);
      bobDecryptedText = receivedMsg.text;
    });

    expect(processedCount).toBe(1);
    expect(bobDecryptedText).toBe(originalPlaintext);

    // 9. Verify relay envelope was ACKed and purged
    const relayEnvsAfterAck = await server.getStore().listEnvelopes(mbBob.mailboxId, 10);
    expect(relayEnvsAfterAck).toHaveLength(0);

    // 10. Bob replies to Alice over reverse relay path
    const replyPlaintext = 'Acknowledged Alice! E2EE network transport confirmed.';
    await convBob.sendMessage(sessionBob, aliceBundle, capAlice.mailboxId, replyPlaintext);

    const bobFetched = await mockServer.fetchEnvelopes(capAlice.mailboxId, capAlice.capability);
    expect(bobFetched).toHaveLength(1);
    const replyPayload = bobFetched[0].payload;

    await netManagerBob.sendEnvelope(sessionBob, mbAlice.mailboxId, replyPayload);


    // Alice syncs from relay and decrypts Bob's reply
    let aliceDecryptedReply = '';
    const aliceProcessedCount = await netManagerAlice.syncMailbox(sessionAlice, async (payload) => {
      const receivedReply = convAlice.receiveMessage(sessionAlice, docBob, payload);
      aliceDecryptedReply = receivedReply.text;
    });

    expect(aliceProcessedCount).toBe(1);
    expect(aliceDecryptedReply).toBe(replyPlaintext);
  });
});
