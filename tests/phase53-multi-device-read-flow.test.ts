import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { readReceiptManager, ReadReceiptPayload } from '../src/messaging/readReceipts.ts';
import { UIMessage } from '../src/ui/app/types.ts';

describe('Phase 53: Multi-Device Read Receipt Flow (Device A -> B -> C)', { timeout: 60000 }, () => {
  let server: RelayServer;
  let baseUrl: string;
  let tempDir: string;
  let cloudDb: SqlCloudDatabase;
  let relayStore: MemoryRelayStore;
  let portCounter = 20500 + Math.floor(Math.random() * 500);

  beforeEach(async () => {
    const testPort = portCounter++;
    baseUrl = `http://127.0.0.1:${testPort}`;
    tempDir = path.join(process.cwd(), 'scratch', `p53_flow_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const dbPath = path.join(tempDir, 'db.json');
    const storageDir = path.join(tempDir, 'obj');
    fs.mkdirSync(storageDir, { recursive: true });

    cloudDb = new SqlCloudDatabase(`file://${dbPath}`);
    relayStore = new MemoryRelayStore();
    await relayStore.init();
    server = new RelayServer({
      port: testPort,
      host: '127.0.0.1',
      store: relayStore,
      cloudDatabase: cloudDb,
      objectStorage: new LocalDiskObjectStorage(storageDir),
    });
    await server.start();
  });

  afterEach(async () => {
    if (server) await server.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createDevice(name: string, customStorage?: MemoryStorageAdapter, customVault?: SpaceVaultManager) {
    const storage = customStorage || new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(storage);
    const vault = customVault || new SpaceVaultManager();
    const idMgr = new SpaceIdentityManager();
    const prekeys = new PrekeyManager(store, idMgr);
    const convMgr = new ConversationManager(store, idMgr, prekeys);
    const client = new CloudClient({ baseUrl, requestTimeoutMs: 60000 });
    const accountManager = new AccountManager(client, vault, idMgr, store, storage);
    return { storage, store, vault, idMgr, prekeys, convMgr, client, accountManager, name };
  }

  it('executes full sequence: A sends 1 -> B reads 1 -> A sends 2 -> B sends 3 -> A reloads -> B reloads -> C fresh login', async () => {
    // =========================================================================
    // STEP 0: INITIALIZE DEVICE A (Alice) & DEVICE B (Bob)
    // =========================================================================
    const devA = createDevice('Device A (Alice)');
    const devB = createDevice('Device B (Bob)');

    const aliceUser = 'alice_p53';
    const alicePass = 'AlicePass123!';
    const bobUser = 'bob_p53';
    const bobPass = 'BobPass123!';

    // Register Alice on Device A
    const aliceReg = await devA.accountManager.registerAccount({
      username: aliceUser,
      password: alicePass,
      spaceName: 'Alice Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    const aliceSession = aliceReg.session;
    const aliceDoc = devA.idMgr.getPublicDocument(aliceSession, devA.store)!;
    devA.prekeys.generateSignedPrekey(aliceSession);
    devA.prekeys.generateOneTimePrekeys(aliceSession, 5);
    const aliceBundle = devA.prekeys.createPrekeyBundle(aliceSession);

    // Register Bob on Device B
    const bobReg = await devB.accountManager.registerAccount({
      username: bobUser,
      password: bobPass,
      spaceName: 'Bob Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });
    const bobSession = bobReg.session;
    const bobDoc = devB.idMgr.getPublicDocument(bobSession, devB.store)!;
    devB.prekeys.generateSignedPrekey(bobSession);
    devB.prekeys.generateOneTimePrekeys(bobSession, 5);
    const bobBundle = devB.prekeys.createPrekeyBundle(bobSession);

    // Bind mailbox ids
    const aliceMailbox = `mbx_${aliceDoc.identityId.slice(0, 12)}`;
    const bobMailbox = `mbx_${bobDoc.identityId.slice(0, 12)}`;
    devA.store.set(aliceSession, 'net_mailbox_binding', { mailboxId: aliceMailbox });
    devB.store.set(bobSession, 'net_mailbox_binding', { mailboxId: bobMailbox });

    // In-memory UI messages maps
    let aliceUiMessages: Record<string, UIMessage[]> = {
      [bobDoc.identityId]: [],
    };
    let bobUiMessages: Record<string, UIMessage[]> = {
      [aliceDoc.identityId]: [],
    };

    // Helper: Alice cloud sync
    async function syncAliceToCloud() {
      await devA.store.setAsync(aliceSession, 'veil:ui:messages', aliceUiMessages);
      await devA.store.setAsync(aliceSession, 'veil:ui:conversations', [
        {
          id: bobDoc.identityId,
          type: 'direct',
          name: 'Bob',
          lastMessage: aliceUiMessages[bobDoc.identityId]?.slice(-1)[0]?.text || '',
          timestamp: Date.now(),
        },
      ]);
      await devA.accountManager.createOrUpdateRecoveryVault(aliceSession, alicePass, aliceUser, FAST_TEST_KDF_PARAMS);
    }

    // Helper: Relay delivery & polling
    async function sendToMailbox(mailboxId: string, payloadBase64: string) {
      await relayStore.saveEnvelope({
        protocolVersion: 'v1',
        envelopeId: `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mailboxId,
        payload: payloadBase64,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        sizeBytes: payloadBase64.length,
      });
    }

    async function pollMailbox(mailboxId: string) {
      const envs = await relayStore.listEnvelopes(mailboxId, 50);
      if (envs.length > 0) {
        await relayStore.deleteEnvelopes(mailboxId, envs.map(e => e.envelopeId));
      }
      return envs;
    }

    // =========================================================================
    // STEP 1: DEVICE A SENDS MESSAGE 1
    // =========================================================================
    const msg1Text = 'Hello Bob! This is message 1.';
    const wireMsg1 = await devA.convMgr.encryptAndPackWireMessage(aliceSession, bobBundle, msg1Text);
    const msg1Id = wireMsg1.deliveryId;

    aliceUiMessages[bobDoc.identityId].push({
      id: msg1Id,
      conversationId: bobDoc.identityId,
      senderId: aliceDoc.identityId,
      text: msg1Text,
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'SENT_TO_RELAY',
    });

    expect(aliceUiMessages[bobDoc.identityId][0].status).toBe('SENT_TO_RELAY');

    // Deliver to Bob's mailbox on relay
    await sendToMailbox(bobMailbox, wireMsg1.wirePayloadBase64);

    // Bob retrieves and decrypts message 1
    const bobEnvelopes1 = await pollMailbox(bobMailbox);
    expect(bobEnvelopes1.length).toBe(1);

    const bobInbound1 = await devB.convMgr.processInboundWirePayload(bobSession, bobEnvelopes1[0].payload);
    expect(bobInbound1.storedMessage.text).toBe(msg1Text);

    bobUiMessages[aliceDoc.identityId].push({
      id: bobInbound1.storedMessage.messageId,
      conversationId: aliceDoc.identityId,
      senderId: aliceDoc.identityId,
      text: bobInbound1.storedMessage.text,
      isOutgoing: false,
      timestamp: bobInbound1.storedMessage.timestamp,
      status: 'DELIVERED_TO_RECIPIENT',
    });

    await syncAliceToCloud();

    // =========================================================================
    // STEP 2: DEVICE B READS MESSAGE 1
    // =========================================================================
    // Bob marks as read and dispatches read receipt
    const receiptWire = await devB.convMgr.encryptAndPackReceipt(bobSession, aliceDoc, {
      type: 'READ_RECEIPT',
      conversationId: aliceDoc.identityId,
      lastReadMessageId: msg1Id,
      readerIdentityId: bobDoc.identityId,
      readAt: Date.now(),
    });

    // Deliver read receipt to Alice's mailbox on relay
    await sendToMailbox(aliceMailbox, receiptWire);

    // Alice polls relay and receives receipt
    const aliceEnvelopes = await pollMailbox(aliceMailbox);
    expect(aliceEnvelopes.length).toBe(1);

    const aliceReceiptInbound = await devA.convMgr.processInboundWirePayload(aliceSession, aliceEnvelopes[0].payload);
    expect(aliceReceiptInbound.receipt).toBeDefined();
    expect(aliceReceiptInbound.receipt?.type).toBe('READ_RECEIPT');

    // Alice processes receipt
    const receiptResult = readReceiptManager.processInboundReceipt(
      aliceReceiptInbound.receipt!,
      aliceUiMessages,
      aliceReceiptInbound.senderDoc.identityId
    );
    expect(receiptResult.didChange).toBe(true);
    aliceUiMessages = receiptResult.updatedMessages;

    // VERIFY: Message 1 status is now READ (Double check mark!)
    expect(aliceUiMessages[bobDoc.identityId][0].status).toBe('READ');

    // Alice commits updated READ state to cloud snapshot
    await syncAliceToCloud();

    // =========================================================================
    // STEP 3: DEVICE A SENDS MESSAGE 2
    // =========================================================================
    const msg2Text = 'Follow up from Alice: Message 2.';
    const wireMsg2 = await devA.convMgr.encryptAndPackWireMessage(aliceSession, bobBundle, msg2Text);
    const msg2Id = wireMsg2.deliveryId;

    aliceUiMessages[bobDoc.identityId].push({
      id: msg2Id,
      conversationId: bobDoc.identityId,
      senderId: aliceDoc.identityId,
      text: msg2Text,
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'SENT_TO_RELAY',
    });

    // Deliver to Bob
    await sendToMailbox(bobMailbox, wireMsg2.wirePayloadBase64);

    const bobEnvelopes2 = await pollMailbox(bobMailbox);
    expect(bobEnvelopes2.length).toBe(1);

    const bobInbound2 = await devB.convMgr.processInboundWirePayload(bobSession, bobEnvelopes2[0].payload);
    bobUiMessages[aliceDoc.identityId].push({
      id: bobInbound2.storedMessage.messageId,
      conversationId: aliceDoc.identityId,
      senderId: aliceDoc.identityId,
      text: bobInbound2.storedMessage.text,
      isOutgoing: false,
      timestamp: bobInbound2.storedMessage.timestamp,
      status: 'DELIVERED_TO_RECIPIENT',
    });

    await syncAliceToCloud();

    // =========================================================================
    // STEP 4: DEVICE B SENDS MESSAGE 3
    // =========================================================================
    const msg3Text = 'Reply from Bob: Message 3.';
    const wireMsg3 = await devB.convMgr.encryptAndPackWireMessage(bobSession, aliceBundle, msg3Text);
    const msg3Id = wireMsg3.deliveryId;

    bobUiMessages[aliceDoc.identityId].push({
      id: msg3Id,
      conversationId: aliceDoc.identityId,
      senderId: bobDoc.identityId,
      text: msg3Text,
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'SENT_TO_RELAY',
    });

    // Deliver to Alice
    await sendToMailbox(aliceMailbox, wireMsg3.wirePayloadBase64);

    const aliceEnvelopes3 = await pollMailbox(aliceMailbox);
    expect(aliceEnvelopes3.length).toBe(1);

    const aliceInbound3 = await devA.convMgr.processInboundWirePayload(aliceSession, aliceEnvelopes3[0].payload);
    aliceUiMessages[bobDoc.identityId].push({
      id: aliceInbound3.storedMessage.messageId,
      conversationId: bobDoc.identityId,
      senderId: bobDoc.identityId,
      text: aliceInbound3.storedMessage.text,
      isOutgoing: false,
      timestamp: aliceInbound3.storedMessage.timestamp,
      status: 'DELIVERED_TO_RECIPIENT',
    });

    // Alice commits full history (msg1 READ, msg2 SENT, msg3 INBOUND) to cloud snapshot
    await syncAliceToCloud();

    // Also commit Bob's local state
    await devB.store.setAsync(bobSession, 'veil:ui:messages', bobUiMessages);
    await devB.store.setAsync(bobSession, 'veil:ui:conversations', [
      {
        id: aliceDoc.identityId,
        type: 'direct',
        name: 'Alice',
        lastMessage: msg3Text,
        timestamp: Date.now(),
      },
    ]);

    // =========================================================================
    // STEP 5: DEVICE A RELOAD (Verify state persistence after page reload)
    // =========================================================================
    // Re-create Device A from its persistent storage adapter and vault
    const devAReloaded = createDevice('Device A Reloaded', devA.storage, devA.vault);
    const aliceSessionReloaded = devAReloaded.vault.unlockSpace(alicePass, aliceSession.spaceId);

    const aliceReloadedMsgs = await devAReloaded.store.getAsync<Record<string, UIMessage[]>>(
      aliceSessionReloaded,
      'veil:ui:messages'
    );
    expect(aliceReloadedMsgs).toBeDefined();
    const aliceChat = aliceReloadedMsgs![bobDoc.identityId];
    expect(aliceChat).toHaveLength(3);

    // Verify Message 1 has status 'READ' (Double check intact!)
    expect(aliceChat[0].text).toBe(msg1Text);
    expect(aliceChat[0].status).toBe('READ');

    // Verify Message 2 has status 'SENT_TO_RELAY'
    expect(aliceChat[1].text).toBe(msg2Text);
    expect(aliceChat[1].status).toBe('SENT_TO_RELAY');

    // Verify Message 3 has status 'DELIVERED_TO_RECIPIENT'
    expect(aliceChat[2].text).toBe(msg3Text);
    expect(aliceChat[2].status).toBe('DELIVERED_TO_RECIPIENT');

    // =========================================================================
    // STEP 6: DEVICE B RELOAD (Verify state persistence on counterparty)
    // =========================================================================
    const devBReloaded = createDevice('Device B Reloaded', devB.storage, devB.vault);
    const bobSessionReloaded = devBReloaded.vault.unlockSpace(bobPass, bobSession.spaceId);

    const bobReloadedMsgs = await devBReloaded.store.getAsync<Record<string, UIMessage[]>>(
      bobSessionReloaded,
      'veil:ui:messages'
    );
    expect(bobReloadedMsgs).toBeDefined();
    const bobChat = bobReloadedMsgs![aliceDoc.identityId];
    expect(bobChat).toHaveLength(3);

    expect(bobChat[0].text).toBe(msg1Text);
    expect(bobChat[1].text).toBe(msg2Text);
    expect(bobChat[2].text).toBe(msg3Text);

    // =========================================================================
    // STEP 7: DEVICE C FRESH LOGIN (Clean client, 0 local storage, full recovery)
    // =========================================================================
    const devC = createDevice('Device C (Fresh Device)');
    // Assert 0 local envelopes exist on Device C
    expect(devC.vault.listEnvelopes().length).toBe(0);

    const restoreResult = await devC.accountManager.restoreAccount({
      username: aliceUser,
      password: alicePass,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(restoreResult.session).toBeDefined();
    expect(devC.vault.listEnvelopes().length).toBe(1);
    const devCSession = restoreResult.session;
    expect(devCSession.spaceId).toBe(aliceSession.spaceId);

    // Verify identity matches
    const devCDoc = devC.idMgr.getPublicDocument(devCSession, devC.store);
    expect(devCDoc?.identityId).toBe(aliceDoc.identityId);

    // Verify conversations restored
    const devCConversations = await devC.store.getAsync<any[]>(devCSession, 'veil:ui:conversations');
    expect(devCConversations).toBeDefined();
    expect(devCConversations?.some((c) => c.id === bobDoc.identityId)).toBe(true);

    // Verify messages restored
    const devCMsgs = await devC.store.getAsync<Record<string, UIMessage[]>>(devCSession, 'veil:ui:messages');
    expect(devCMsgs).toBeDefined();
    const devCChat = devCMsgs![bobDoc.identityId];
    expect(devCChat).toBeDefined();
    expect(devCChat).toHaveLength(3);

    // CRITICAL DOUBLE-CHECK VERIFICATION ON FRESH DEVICE:
    // Message 1 MUST be in 'READ' status!
    expect(devCChat[0].text).toBe(msg1Text);
    expect(devCChat[0].status).toBe('READ');

    // Message 2
    expect(devCChat[1].text).toBe(msg2Text);
    expect(devCChat[1].status).toBe('SENT_TO_RELAY');

    // Message 3
    expect(devCChat[2].text).toBe(msg3Text);
    expect(devCChat[2].status).toBe('DELIVERED_TO_RECIPIENT');
  });
});
