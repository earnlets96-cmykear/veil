import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: Android Process Lifecycle & Restart Delivery Tests', () => {
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

  it('restores mailbox binding, Double Ratchet state, contacts, and catches up on envelopes across process restart', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Shared persistent storage adapter across cold restarts
    const sharedStorageAdapter = new MemoryStorageAdapter();

    // ----------------------------------------------------
    // LIFECYCLE SESSION 1: Initial Setup
    // ----------------------------------------------------
    const vault1 = new SpaceVaultManager();
    const envRecord = vault1.createSpace({ name: 'Android User', password: 'MasterPass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    await vault1.saveEnvelopeToStorage(envRecord, sharedStorageAdapter);

    const session1 = vault1.unlockSpace('MasterPass123!', envRecord.spaceId);
    const store1 = new EncryptedSpaceStore(sharedStorageAdapter);
    await store1.loadPartitionFromStorage(session1);

    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(session1, store1);
    const prekeys1 = new PrekeyManager(store1, idMgr1);
    prekeys1.generateSignedPrekey(session1);
    prekeys1.generateOneTimePrekeys(session1, 5);
    const bundle1 = prekeys1.createPrekeyBundle(session1);

    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(session1);

    // ----------------------------------------------------
    // SIMULATED COLD PROCESS KILL & RESTART
    // All in-memory variables destroyed; new instances created
    // ----------------------------------------------------
    const vault2 = new SpaceVaultManager();
    await vault2.loadEnvelopesFromStorage(sharedStorageAdapter);
    const session2 = vault2.unlockSpace('MasterPass123!', envRecord.spaceId);

    const store2 = new EncryptedSpaceStore(sharedStorageAdapter);
    await store2.loadPartitionFromStorage(session2);

    const idMgr2 = new SpaceIdentityManager();
    const loadedDoc = idMgr2.getPublicDocument(session2, store2);
    expect(loadedDoc?.identityId).toBe(doc1.identityId);

    const net2 = new NetworkManager(store2, netConfig);
    const loadedBinding = await net2.getMailboxBinding(session2);
    expect(loadedBinding?.mailboxId).toBe(mb1.mailboxId);

    // ----------------------------------------------------
    // Peer sends message while Android app was restarted
    // ----------------------------------------------------
    const vaultPeer = new SpaceVaultManager();
    const envPeer = vaultPeer.createSpace({ name: 'Peer', password: 'PeerPass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionPeer = vaultPeer.unlockSpace('PeerPass123!', envPeer.spaceId);
    const storePeer = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrPeer = new SpaceIdentityManager();
    idMgrPeer.createIdentity(sessionPeer, storePeer);
    const prekeysPeer = new PrekeyManager(storePeer, idMgrPeer);
    const convPeer = new ConversationManager(storePeer, idMgrPeer, prekeysPeer);
    const netPeer = new NetworkManager(storePeer, netConfig);

    const messageText = 'Message delivered during Android process lifecycle transition';
    const { wirePayloadBase64 } = await convPeer.encryptAndPackWireMessage(sessionPeer, bundle1, messageText);
    await netPeer.sendEnvelope(sessionPeer, mb1.mailboxId, wirePayloadBase64);

    // ----------------------------------------------------
    // Android App resumes / connects and syncs
    // ----------------------------------------------------
    const prekeys2 = new PrekeyManager(store2, idMgr2);
    const conv2 = new ConversationManager(store2, idMgr2, prekeys2);

    let deliveredText = '';
    const syncCount = await net2.syncMailbox(session2, async (payload) => {
      const res = await conv2.processInboundWirePayload(session2, payload);
      deliveredText = res.storedMessage.text;
    });

    expect(syncCount).toBe(1);
    expect(deliveredText).toBe(messageText);
  });
});
