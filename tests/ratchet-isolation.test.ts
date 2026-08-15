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

describe('VEIL Phase 4: Cross-Space Ratchet Isolation Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let server: MockTransportServer;
  let client: TransportClient;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    server = new MockTransportServer();
    client = new TransportClient({ adapter: server, store });
  });

  it('CROSS-SPACE ISOLATION: Private Space cannot decrypt messages destined for Main Space', async () => {
    // 1. Setup Main Space and Private Space on the same device
    vault.createSpace({ name: 'Main', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassPriv', kdfParams: FAST_TEST_KDF_PARAMS });

    // 2. Setup external contact Alice
    vault.createSpace({ name: 'Alice', password: 'PassAlice', kdfParams: FAST_TEST_KDF_PARAMS });

    const mainSess = vault.unlockSpace('PassMain');
    const privSess = vault.unlockSpace('PassPriv');
    const aliceSess = vault.unlockSpace('PassAlice');

    const mainDoc = idMgr.createIdentity(mainSess, store);
    const privDoc = idMgr.createIdentity(privSess, store);
    const aliceDoc = idMgr.createIdentity(aliceSess, store);

    const prekeyMgrMain = new PrekeyManager(store, idMgr);
    const prekeyMgrPriv = new PrekeyManager(store, idMgr);
    const prekeyMgrAlice = new PrekeyManager(store, idMgr);

    prekeyMgrMain.generateOneTimePrekeys(mainSess, 3);
    const mainBundle = prekeyMgrMain.createPrekeyBundle(mainSess);

    const convAlice = new ConversationManager(store, idMgr, prekeyMgrAlice, client);
    const convPriv = new ConversationManager(store, idMgr, prekeyMgrPriv, client);

    const capMain = generateMailboxCapability();
    await client.registerMailbox(mainSess, capMain);

    // 3. Alice sends message to Main Space
    await convAlice.sendMessage(
      aliceSess,
      mainBundle,
      capMain.mailboxId,
      'Confidential for Main Space only'
    );

    // Fetch envelope
    const envs = await client.fetchAndReceive(mainSess, capMain.mailboxId, capMain.capability);
    expect(envs.length).toBe(1);

    // 4. Private Space attempts to decrypt Main Space's envelope -> MUST FAIL
    expect(() => {
      convPriv.receiveMessage(privSess, aliceDoc, envs[0].payload);
    }).toThrow();
  });
});
