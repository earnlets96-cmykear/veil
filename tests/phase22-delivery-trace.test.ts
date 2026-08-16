import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: Phone 2 → Phone 1 Complete Delivery Trace Test', () => {
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

  it('TRACES ALL 12 BOUNDARIES: Phone 1 creates Space/Mailbox/Invite -> Phone 2 imports -> Phone 2 encrypts/sends -> Relay routes -> Phone 1 receives/persists/ACKs/decrypts', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    // Stage 1: Phone 1 (Recipient) Setup
    const vault1 = new SpaceVaultManager();
    const env1 = vault1.createSpace({ name: 'Phone 1 Space', password: 'Password1!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session1 = vault1.unlockSpace('Password1!', env1.spaceId);
    const store1 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr1 = new SpaceIdentityManager();
    const doc1 = idMgr1.createIdentity(session1, store1);
    const net1 = new NetworkManager(store1, netConfig);
    const mb1 = await net1.getOrCreateMailbox(session1);
    const prekeys1 = new PrekeyManager(store1, idMgr1);
    prekeys1.generateSignedPrekey(session1);
    prekeys1.generateOneTimePrekeys(session1, 5);
    const bundle1 = prekeys1.createPrekeyBundle(session1);
    const conv1 = new ConversationManager(store1, idMgr1, prekeys1);
    const contacts1 = new ContactManager(store1);

    // Stage 2: Phone 1 exports signed invitation containing its Mailbox & PrekeyBundle
    const id1 = idMgr1.loadIdentity(session1, store1)!;
    const invite1 = InvitationManager.createInvitation(
      doc1,
      id1.signingPrivateKey,
      'Phone 1 User',
      undefined,
      mb1.mailboxId,
      bundle1
    );
    const inviteStr1 = InvitationManager.toShareableString(invite1);

    // Stage 3: Phone 2 (Sender) Setup
    const vault2 = new SpaceVaultManager();
    const env2 = vault2.createSpace({ name: 'Phone 2 Space', password: 'Password2!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session2 = vault2.unlockSpace('Password2!', env2.spaceId);
    const store2 = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr2 = new SpaceIdentityManager();
    const doc2 = idMgr2.createIdentity(session2, store2);
    const net2 = new NetworkManager(store2, netConfig);
    const mb2 = await net2.getOrCreateMailbox(session2);
    const prekeys2 = new PrekeyManager(store2, idMgr2);
    prekeys2.generateSignedPrekey(session2);
    prekeys2.generateOneTimePrekeys(session2, 5);
    const bundle2 = prekeys2.createPrekeyBundle(session2);
    const conv2 = new ConversationManager(store2, idMgr2, prekeys2);
    const contacts2 = new ContactManager(store2);

    // Stage 4: Phone 2 parses and verifies Phone 1's invitation
    const parsedInvite1 = InvitationManager.verifyAndParseInvitation(inviteStr1);
    expect(parsedInvite1.identityId).toBe(doc1.identityId);
    expect(parsedInvite1.mailboxId).toBe(mb1.mailboxId);
    expect(parsedInvite1.prekeyBundle).toBeDefined();

    // Stage 5: Phone 2 saves Phone 1 as Contact
    const contactP1 = await contacts2.addContactFromInvitation(session2, parsedInvite1);
    expect(contactP1.mailboxId).toBe(mb1.mailboxId);
    expect(contactP1.prekeyBundle).toBeDefined();

    // Stage 6: Phone 2 encrypts message using Double Ratchet / X3DH
    const messageText = 'HELLO FROM PHONE 2 (PHASE 22 VERIFIED)';
    const { wirePayloadBase64, deliveryId } = await conv2.encryptAndPackWireMessage(
      session2,
      contactP1.prekeyBundle!,
      messageText
    );
    expect(deliveryId).toMatch(/^msg_/);

    // Stage 7: Phone 2 transmits envelope to Phone 1's Mailbox on Relay
    const sentItem = await net2.sendEnvelope(session2, contactP1.mailboxId!, wirePayloadBase64);
    expect(sentItem.status).toBe('SENT_TO_RELAY');

    // Stage 8: Verify Relay stored envelope under mb1 without plaintext
    const relayEnvs = await server.getStore().listEnvelopes(mb1.mailboxId, 10);
    expect(relayEnvs).toHaveLength(1);
    expect(relayEnvs[0].payload).not.toContain(messageText);

    // Stage 9: Phone 1 starts listening / syncs mailbox
    let phone1ReceivedText = '';
    let phone1SenderId = '';

    const processedCount = await net1.syncMailbox(session1, async (payload) => {
      const res = await conv1.processInboundWirePayload(session1, payload);
      phone1ReceivedText = res.storedMessage.text;
      phone1SenderId = res.storedMessage.senderIdentityId;
    });

    // Stage 10: Verify Phone 1 successfully received, decrypted, and indexed under Phone 2's ID
    expect(processedCount).toBe(1);
    expect(phone1ReceivedText).toBe(messageText);
    expect(phone1SenderId).toBe(doc2.identityId);

    // Stage 11: Verify Relay envelope was ACKed and purged
    const relayEnvsAfterAck = await server.getStore().listEnvelopes(mb1.mailboxId, 10);
    expect(relayEnvsAfterAck).toHaveLength(0);

    // Stage 12: Verify Phone 1 has message stored in local encrypted conversation history
    const storedHistory = conv1.getMessages(session1, doc2.identityId);
    expect(storedHistory).toHaveLength(1);
    expect(storedHistory[0].text).toBe(messageText);
    expect(storedHistory[0].isOutgoing).toBe(false);
  });
});
