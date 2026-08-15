import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { TransportClient } from '../src/transport/client.ts';
import { generateMailboxCapability } from '../src/transport/capability.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 4: Full End-to-End Conversation Integration Tests', () => {
  let vault: SpaceVaultManager;
  let storeAlice: EncryptedSpaceStore;
  let storeBob: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let server: MockTransportServer;
  let clientAlice: TransportClient;
  let clientBob: TransportClient;
  let convAlice: ConversationManager;
  let convBob: ConversationManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    storeAlice = new EncryptedSpaceStore();
    storeBob = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    server = new MockTransportServer();

    clientAlice = new TransportClient({ adapter: server, store: storeAlice });
    clientBob = new TransportClient({ adapter: server, store: storeBob });

    const prekeyMgrAlice = new PrekeyManager(storeAlice, idMgr);
    const prekeyMgrBob = new PrekeyManager(storeBob, idMgr);

    convAlice = new ConversationManager(storeAlice, idMgr, prekeyMgrAlice, clientAlice);
    convBob = new ConversationManager(storeBob, idMgr, prekeyMgrBob, clientBob);
  });

  it('COMPLETE E2EE CONVERSATION: Alice sends to offline Bob -> Bob comes online -> Bob decrypts -> Bob replies', async () => {
    // 1. Create Spaces and Identities
    vault.createSpace({ name: 'Alice', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });

    const aliceSess = vault.unlockSpace('PassA');
    const bobSess = vault.unlockSpace('PassB');

    const aliceDoc = idMgr.createIdentity(aliceSess, storeAlice);
    const bobDoc = idMgr.createIdentity(bobSess, storeBob);

    // 2. Setup Bob's Mailbox & Prekey Bundle on untrusted server
    const capBob = generateMailboxCapability();
    await clientBob.registerMailbox(bobSess, capBob);

    const prekeyMgrBob = new PrekeyManager(storeBob, idMgr);
    prekeyMgrBob.generateOneTimePrekeys(bobSess, 5);
    const bobBundle = prekeyMgrBob.createPrekeyBundle(bobSess);

    // Setup Alice's Mailbox
    const capAlice = generateMailboxCapability();
    await clientAlice.registerMailbox(aliceSess, capAlice);
    const prekeyMgrAlice = new PrekeyManager(storeAlice, idMgr);
    prekeyMgrAlice.generateOneTimePrekeys(aliceSess, 5);
    const aliceBundle = prekeyMgrAlice.createPrekeyBundle(aliceSess);

    // 3. Alice sends message while Bob is offline
    await convAlice.sendMessage(
      aliceSess,
      bobBundle,
      capBob.mailboxId,
      'Hello Bob, this is an end-to-end encrypted message!'
    );

    // Verify message exists in Alice's local history
    const aliceHistory1 = convAlice.getMessages(aliceSess, bobDoc.identityId);
    expect(aliceHistory1.length).toBe(1);
    expect(aliceHistory1[0].text).toBe('Hello Bob, this is an end-to-end encrypted message!');
    expect(aliceHistory1[0].isOutgoing).toBe(true);

    // 4. Bob comes online, fetches transport envelopes
    const receivedEnvelopes = await clientBob.fetchAndReceive(bobSess, capBob.mailboxId, capBob.capability);
    expect(receivedEnvelopes.length).toBe(1);

    // 5. Bob decrypts envelope payload using Alice's IdentityDocument
    const bobReceivedMsg = convBob.receiveMessage(
      bobSess,
      aliceDoc,
      receivedEnvelopes[0].payload
    );
    expect(bobReceivedMsg.text).toBe('Hello Bob, this is an end-to-end encrypted message!');
    expect(bobReceivedMsg.isOutgoing).toBe(false);

    // 6. Bob replies to Alice
    await convBob.sendMessage(
      bobSess,
      aliceBundle,
      capAlice.mailboxId,
      'Hi Alice! Received loud and clear.'
    );

    // 7. Alice fetches Bob's reply and decrypts
    const aliceEnvelopes = await clientAlice.fetchAndReceive(aliceSess, capAlice.mailboxId, capAlice.capability);
    expect(aliceEnvelopes.length).toBe(1);

    const aliceReceivedReply = convAlice.receiveMessage(
      aliceSess,
      bobDoc,
      aliceEnvelopes[0].payload
    );
    expect(aliceReceivedReply.text).toBe('Hi Alice! Received loud and clear.');
  });
});
