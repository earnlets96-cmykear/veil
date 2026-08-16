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

describe('VEIL Phase 22: Real-Device Contract & Acceptance Test Suite', () => {
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

  it('verifies 20-message bidirectional exchange and real-device acceptance contract', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Client 1 (Phone 1)
    const vault1 = new SpaceVaultManager();
    const s1 = vault1.unlockSpace('Pass1!', vault1.createSpace({ name: 'Phone 1', password: 'Pass1!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(s1, store1);
    const pre1 = new PrekeyManager(store1, idMgr1);
    pre1.generateSignedPrekey(s1);
    pre1.generateOneTimePrekeys(s1, 10);
    const bundle1 = pre1.createPrekeyBundle(s1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(s1);
    const conv1 = new ConversationManager(store1, idMgr1, pre1);
    const contacts1 = new ContactManager(store1);

    // Client 2 (Phone 2)
    const vault2 = new SpaceVaultManager();
    const s2 = vault2.unlockSpace('Pass2!', vault2.createSpace({ name: 'Phone 2', password: 'Pass2!', kdfParams: FAST_TEST_KDF_PARAMS }).spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(s2, store2);
    const pre2 = new PrekeyManager(store2, idMgr2);
    pre2.generateSignedPrekey(s2);
    pre2.generateOneTimePrekeys(s2, 10);
    const bundle2 = pre2.createPrekeyBundle(s2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(s2);
    const conv2 = new ConversationManager(store2, idMgr2, pre2);
    const contacts2 = new ContactManager(store2);

    // Exchange invitations
    const id1 = idMgr1.loadIdentity(s1, store1)!;
    const inv1 = InvitationManager.createInvitation(doc1, id1.signingPrivateKey, 'Phone 1', undefined, mb1.mailboxId, bundle1);
    const contactP1 = await contacts2.addContactFromInvitation(s2, inv1);

    const id2 = idMgr2.loadIdentity(s2, store2)!;
    const inv2 = InvitationManager.createInvitation(doc2, id2.signingPrivateKey, 'Phone 2', undefined, mb2.mailboxId, bundle2);
    const contactP2 = await contacts1.addContactFromInvitation(s1, inv2);

    // Exchange 20 alternating messages
    for (let i = 1; i <= 20; i++) {
      if (i % 2 !== 0) {
        // Phone 2 -> Phone 1
        const text = `Phone 2 message #${i}`;
        const { wirePayloadBase64 } = await conv2.encryptAndPackWireMessage(s2, contactP1.prekeyBundle!, text);
        await net2.sendEnvelope(s2, contactP1.mailboxId!, wirePayloadBase64);

        let received = '';
        await net1.syncMailbox(s1, async (payload) => {
          const res = await conv1.processInboundWirePayload(s1, payload);
          received = res.storedMessage.text;
        });
        expect(received).toBe(text);
      } else {
        // Phone 1 -> Phone 2
        const text = `Phone 1 message #${i}`;
        const { wirePayloadBase64 } = await conv1.encryptAndPackWireMessage(s1, contactP2.prekeyBundle!, text);
        await net1.sendEnvelope(s1, contactP2.mailboxId!, wirePayloadBase64);

        let received = '';
        await net2.syncMailbox(s2, async (payload) => {
          const res = await conv2.processInboundWirePayload(s2, payload);
          received = res.storedMessage.text;
        });
        expect(received).toBe(text);
      }
    }

    // Verify conversation message count in history
    const history1 = conv1.getMessages(s1, doc2.identityId);
    const history2 = conv2.getMessages(s2, doc1.identityId);
    expect(history1).toHaveLength(20);
    expect(history2).toHaveLength(20);
  });
});
