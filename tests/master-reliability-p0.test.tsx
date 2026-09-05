import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { WebSocketTransport } from '../src/network/websocketTransport.ts';
import { AppProvider } from '../src/ui/app/AppState.tsx';
import { GroupDetailsModal } from '../src/ui/components/GroupDetailsModal.tsx';

describe('VEIL Master Reliability P0 Acceptance Suite', () => {
  let server: RelayServer;
  let relayPort: number;
  let directoryClient: DirectoryClient;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const res = await server.start();
    relayPort = res.port;
    directoryClient = new DirectoryClient(`http://127.0.0.1:${relayPort}`);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('P0-1: Traces full bidirectional 1-to-1 message delivery (A -> B and B -> A)', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // 1. Initialize Account A (Alice)
    const vA = new SpaceVaultManager();
    const sA = vA.unlockSpace('PassAlice123!', vA.createSpace({ name: 'Alice Space', password: 'PassAlice123!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    const docA = idMgrA.createIdentity(sA, storeA);
    const idA = idMgrA.loadIdentity(sA, storeA)!;
    const preA = new PrekeyManager(storeA, idMgrA);
    preA.generateSignedPrekey(sA);
    preA.generateOneTimePrekeys(sA, 10);
    const bundleA = preA.createPrekeyBundle(sA);
    const netA = new NetworkManager(storeA, netConfig);
    const mbA = await netA.getOrCreateMailbox(sA);
    const convA = new ConversationManager(storeA, idMgrA, preA);

    const profileA = createSignedProfile(docA.identityId, idA.signingPrivateKey, 'alice', 'Alice Wonderland', mbA.mailboxId, bundleA);
    await directoryClient.registerProfile(profileA);

    // 2. Initialize Account B (Bob)
    const vB = new SpaceVaultManager();
    const sB = vB.unlockSpace('PassBob123!', vB.createSpace({ name: 'Bob Space', password: 'PassBob123!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    const docB = idMgrB.createIdentity(sB, storeB);
    const idB = idMgrB.loadIdentity(sB, storeB)!;
    const preB = new PrekeyManager(storeB, idMgrB);
    preB.generateSignedPrekey(sB);
    preB.generateOneTimePrekeys(sB, 10);
    const bundleB = preB.createPrekeyBundle(sB);
    const netB = new NetworkManager(storeB, netConfig);
    const mbB = await netB.getOrCreateMailbox(sB);
    const convB = new ConversationManager(storeB, idMgrB, preB);

    const profileB = createSignedProfile(docB.identityId, idB.signingPrivateKey, 'bob', 'Bob Builder', mbB.mailboxId, bundleB);
    await directoryClient.registerProfile(profileB);

    // 3. Alice discovers Bob from Directory
    const bobDirectoryProfile = await directoryClient.getProfileByUsername('bob');
    expect(bobDirectoryProfile).not.toBeNull();
    expect(bobDirectoryProfile!.identityId).toBe(docB.identityId);

    // 4. Direction 1: Alice sends 1-to-1 message to Bob
    const aliceText = 'Hello Bob! This is message from Alice.';
    const { wirePayloadBase64: aliceWire, deliveryId: msg1Id } = await convA.encryptAndPackWireMessage(
      sA,
      bobDirectoryProfile!.prekeyBundle,
      aliceText
    );

    // Alice enqueues and flushes to relay
    await netA.sendEnvelope(sA, bobDirectoryProfile!.mailboxId, aliceWire);
    await netA.flushOutboundQueue(sA);

    // Bob syncs mailbox from relay
    let bobReceivedPayload = '';
    const bobProcessed = await netB.syncMailbox(sB, async (payload) => {
      bobReceivedPayload = payload;
    });
    expect(bobProcessed).toBe(1);

    // Bob processes and decrypts Alice's wire message
    const bobInboundResult = await convB.processInboundWirePayload(sB, bobReceivedPayload);
    expect(bobInboundResult.storedMessage.text).toBe(aliceText);
    expect(bobInboundResult.senderDoc.identityId).toBe(docA.identityId);

    // Verify Bob's Double Ratchet session is established with Alice
    expect(convB.hasSession(sB, docA.identityId)).toBe(true);

    // 5. Direction 2 (The Critical Acceptance Gate): Bob replies to Alice
    // Bob replies using the existing session WITHOUT needing a PrekeyBundle for Alice!
    const bobReplyText = 'Hello Alice, I received your message loud and clear!';
    const { wirePayloadBase64: bobReplyWire } = await convB.encryptAndPackWireMessage(
      sB,
      { identityId: docA.identityId },
      bobReplyText
    );

    // Bob sends reply to Alice's mailbox
    await netB.sendEnvelope(sB, mbA.mailboxId, bobReplyWire);
    await netB.flushOutboundQueue(sB);

    // Alice syncs mailbox from relay
    let aliceReceivedPayload = '';
    const aliceProcessed = await netA.syncMailbox(sA, async (payload) => {
      aliceReceivedPayload = payload;
    });
    expect(aliceProcessed).toBe(1);

    // Alice processes and decrypts Bob's wire message
    const aliceInboundResult = await convA.processInboundWirePayload(sA, aliceReceivedPayload);
    expect(aliceInboundResult.storedMessage.text).toBe(bobReplyText);
    expect(aliceInboundResult.senderDoc.identityId).toBe(docB.identityId);

    // 6. Verify full conversation history on both sides
    const aliceHistory = convA.getMessages(sA, docB.identityId);
    expect(aliceHistory.length).toBe(2);
    expect(aliceHistory[0].text).toBe(aliceText);
    expect(aliceHistory[0].isOutgoing).toBe(true);
    expect(aliceHistory[1].text).toBe(bobReplyText);
    expect(aliceHistory[1].isOutgoing).toBe(false);

    const bobHistory = convB.getMessages(sB, docA.identityId);
    expect(bobHistory.length).toBe(2);
    expect(bobHistory[0].text).toBe(aliceText);
    expect(bobHistory[0].isOutgoing).toBe(false);
    expect(bobHistory[1].text).toBe(bobReplyText);
    expect(bobHistory[1].isOutgoing).toBe(true);
  });

  it('P0-3: Group roster convergence and group message delivery across all participants', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Space 1: Alice
    const v1 = new SpaceVaultManager();
    const s1 = v1.unlockSpace('A!', v1.createSpace({ name: 'A', password: 'A!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const grp1 = new GroupManager(store1, idMgr1);

    // Space 2: Bob
    const v2 = new SpaceVaultManager();
    const s2 = v2.unlockSpace('B!', v2.createSpace({ name: 'B', password: 'B!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const grp2 = new GroupManager(store2, idMgr2);

    // Space 3: Charlie
    const v3 = new SpaceVaultManager();
    const s3 = v3.unlockSpace('C!', v3.createSpace({ name: 'C', password: 'C!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store3 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr3 = new SpaceIdentityManager();
    const doc3 = idMgr3.createIdentity(s3, store3);
    const grp3 = new GroupManager(store3, idMgr3);

    // 1. Alice creates group
    const { state: initialGroup } = grp1.createGroup(s1, { name: 'Alpha Team', description: 'Secret group' });
    expect(initialGroup.members[doc1.identityId]).toBeDefined();

    // 2. Alice adds Bob
    const { distribution: distForBob } = grp1.addMember(s1, initialGroup.groupId, doc2.identityId, doc2.signingPublicKey, 'MEMBER');

    // 3. Alice adds Charlie
    const { distribution: distForCharlie } = grp1.addMember(s1, initialGroup.groupId, doc3.identityId, doc3.signingPublicKey, 'MEMBER');

    const finalGroupOnAlice = grp1.loadGroupState(s1, initialGroup.groupId)!;
    expect(Object.keys(finalGroupOnAlice.members).length).toBe(3);

    // 4. Bob and Charlie receive the canonical roster from Alice
    grp2.saveGroupState(s2, finalGroupOnAlice);
    grp3.saveGroupState(s3, finalGroupOnAlice);

    // Bob processes Alice's sender key
    grp2.processSenderKeyDistribution(s2, distForBob, doc1.signingPublicKey);
    // Charlie processes Alice's sender key
    grp3.processSenderKeyDistribution(s3, distForCharlie, doc1.signingPublicKey);

    // 5. Alice sends a group message
    const aliceMsg = 'Welcome to Alpha Team everyone!';
    const { payload: ciphertextFromAlice } = grp1.encryptGroupMessage(s1, initialGroup.groupId, aliceMsg);

    // Bob decrypts Alice's group message
    const bobDecrypted = grp2.decryptGroupMessage(s2, ciphertextFromAlice, doc1.signingPublicKey);
    expect(bobDecrypted.text).toBe(aliceMsg);

    // Charlie decrypts Alice's group message
    const charlieDecrypted = grp3.decryptGroupMessage(s3, ciphertextFromAlice, doc1.signingPublicKey);
    expect(charlieDecrypted.text).toBe(aliceMsg);

    // 6. Bob sends a group message back
    const bobDist = grp2.exportSenderKeyDistribution(s2, initialGroup.groupId);
    const bobMsg = 'Thanks Alice, glad to be here!';
    const { payload: ciphertextFromBob } = grp2.encryptGroupMessage(s2, initialGroup.groupId, bobMsg);

    // Alice processes Bob's sender key and decrypts
    grp1.processSenderKeyDistribution(s1, bobDist, doc2.signingPublicKey);
    const aliceDecryptedFromBob = grp1.decryptGroupMessage(s1, ciphertextFromBob, doc2.signingPublicKey);
    expect(aliceDecryptedFromBob.text).toBe(bobMsg);

    // Charlie processes Bob's sender key and decrypts
    grp3.processSenderKeyDistribution(s3, bobDist, doc2.signingPublicKey);
    const charlieDecryptedFromBob = grp3.decryptGroupMessage(s3, ciphertextFromBob, doc2.signingPublicKey);
    expect(charlieDecryptedFromBob.text).toBe(bobMsg);
  });

  it('P0-2: GroupDetailsModal renders without throwing "profile is not defined"', () => {
    // Render GroupDetailsModal inside AppProvider
    expect(() => {
      renderToStaticMarkup(
        <AppProvider>
          <GroupDetailsModal conversationId="test_group_1" />
        </AppProvider>
      );
    }).not.toThrow();
  });

  it('P0-PRODUCTION: Live bidirectional E2EE message exchange on https://veil-rga0.onrender.com', async () => {
    const prodConfig = {
      httpUrl: 'https://veil-rga0.onrender.com',
      wsUrl: 'wss://veil-rga0.onrender.com/v1/ws',
    };
    const prodDirectory = new DirectoryClient(prodConfig.httpUrl);

    // 1. Initialize Alice on Production
    const vA = new SpaceVaultManager();
    const sA = vA.unlockSpace('ProdPassAlice123!', vA.createSpace({ name: 'Prod Alice', password: 'ProdPassAlice123!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    const docA = idMgrA.createIdentity(sA, storeA);
    const idA = idMgrA.loadIdentity(sA, storeA)!;
    const preA = new PrekeyManager(storeA, idMgrA);
    preA.generateSignedPrekey(sA);
    preA.generateOneTimePrekeys(sA, 5);
    const bundleA = preA.createPrekeyBundle(sA);
    const netA = new NetworkManager(storeA, prodConfig);
    const mbA = await netA.getOrCreateMailbox(sA);
    const convA = new ConversationManager(storeA, idMgrA, preA);

    const aliceUsername = `prod_a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const profileA = createSignedProfile(docA.identityId, idA.signingPrivateKey, aliceUsername, 'Production Alice', mbA.mailboxId, bundleA);
    await prodDirectory.registerProfile(profileA);

    // 2. Initialize Bob on Production
    const vB = new SpaceVaultManager();
    const sB = vB.unlockSpace('ProdPassBob123!', vB.createSpace({ name: 'Prod Bob', password: 'ProdPassBob123!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    const docB = idMgrB.createIdentity(sB, storeB);
    const idB = idMgrB.loadIdentity(sB, storeB)!;
    const preB = new PrekeyManager(storeB, idMgrB);
    preB.generateSignedPrekey(sB);
    preB.generateOneTimePrekeys(sB, 5);
    const bundleB = preB.createPrekeyBundle(sB);
    const netB = new NetworkManager(storeB, prodConfig);
    const mbB = await netB.getOrCreateMailbox(sB);
    const convB = new ConversationManager(storeB, idMgrB, preB);

    const bobUsername = `prod_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const profileB = createSignedProfile(docB.identityId, idB.signingPrivateKey, bobUsername, 'Production Bob', mbB.mailboxId, bundleB);
    await prodDirectory.registerProfile(profileB);

    // 3. Alice discovers Bob from Production Directory
    const bobDirectoryProfile = await prodDirectory.getProfileByUsername(bobUsername);
    expect(bobDirectoryProfile).not.toBeNull();
    expect(bobDirectoryProfile!.identityId).toBe(docB.identityId);

    // 4. Direction 1: Alice sends to Bob over Production Relay
    const aliceMsg = 'Live cloud message: Alice to Bob on Render';
    const { wirePayloadBase64: aliceWire } = await convA.encryptAndPackWireMessage(
      sA,
      bobDirectoryProfile!.prekeyBundle,
      aliceMsg
    );
    await netA.sendEnvelope(sA, bobDirectoryProfile!.mailboxId, aliceWire);
    await netA.flushOutboundQueue(sA);

    // Bob syncs mailbox from Render
    let bobReceived = '';
    const bobCount = await netB.syncMailbox(sB, async (payload) => {
      bobReceived = payload;
    });
    expect(bobCount).toBe(1);

    const bobDecrypted = await convB.processInboundWirePayload(sB, bobReceived);
    expect(bobDecrypted.storedMessage.text).toBe(aliceMsg);
    expect(bobDecrypted.senderDoc.identityId).toBe(docA.identityId);
    expect(convB.hasSession(sB, docA.identityId)).toBe(true);

    // 5. Direction 2: Bob replies to Alice over Production Relay (using active ratchet, NO prekey bundle needed!)
    const bobReply = 'Live cloud reply: Bob received Alice message on Render';
    const { wirePayloadBase64: bobWire } = await convB.encryptAndPackWireMessage(
      sB,
      { identityId: docA.identityId },
      bobReply
    );
    await netB.sendEnvelope(sB, mbA.mailboxId, bobWire);
    await netB.flushOutboundQueue(sB);

    // Alice syncs mailbox from Render
    let aliceReceived = '';
    const aliceCount = await netA.syncMailbox(sA, async (payload) => {
      aliceReceived = payload;
    });
    expect(aliceCount).toBe(1);

    const aliceDecrypted = await convA.processInboundWirePayload(sA, aliceReceived);
    expect(aliceDecrypted.storedMessage.text).toBe(bobReply);
    expect(aliceDecrypted.senderDoc.identityId).toBe(docB.identityId);
  }, 30000);
});
