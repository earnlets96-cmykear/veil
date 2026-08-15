import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { TransportClient } from '../src/transport/client.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxCapability } from '../src/transport/capability.ts';
import { createTransportEnvelope } from '../src/transport/envelope.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 3: Cross-Space Transport Isolation Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let server: MockTransportServer;
  let client: TransportClient;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    server = new MockTransportServer();
    client = new TransportClient({ adapter: server, store });
  });

  it('Main Space, Private Space, and Decoy Space maintain independent mailboxes and transport state', async () => {
    vault.createSpace({ name: 'Main', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassPriv', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Decoy', password: 'PassDecoy', isDecoy: true, kdfParams: FAST_TEST_KDF_PARAMS });

    const mainSess = vault.unlockSpace('PassMain');
    const privSess = vault.unlockSpace('PassPriv');
    const decoySess = vault.unlockSpace('PassDecoy');

    const capMain = generateMailboxCapability();
    const capPriv = generateMailboxCapability();
    const capDecoy = generateMailboxCapability();

    // Register mailboxes on untrusted server
    await client.registerMailbox(mainSess, capMain);
    await client.registerMailbox(privSess, capPriv);
    await client.registerMailbox(decoySess, capDecoy);

    // Verify all 3 mailboxes exist independently on the server
    const statusMain = await server.getMailboxStatus(capMain.mailboxId, capMain.capability);
    const statusPriv = await server.getMailboxStatus(capPriv.mailboxId, capPriv.capability);
    const statusDecoy = await server.getMailboxStatus(capDecoy.mailboxId, capDecoy.capability);

    expect(statusMain!.mailboxId).not.toBe(statusPriv!.mailboxId);
    expect(statusMain!.mailboxId).not.toBe(statusDecoy!.mailboxId);
    expect(statusPriv!.mailboxId).not.toBe(statusDecoy!.mailboxId);
  });

  it('CROSS-SPACE ATTACK: Private Space cannot fetch from Main Space mailbox', async () => {
    vault.createSpace({ name: 'Main', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassPriv', kdfParams: FAST_TEST_KDF_PARAMS });

    const mainSess = vault.unlockSpace('PassMain');
    const privSess = vault.unlockSpace('PassPriv');

    const capMain = generateMailboxCapability();
    const capPriv = generateMailboxCapability();

    await client.registerMailbox(mainSess, capMain);
    await client.registerMailbox(privSess, capPriv);

    // Try fetching Main mailbox with Private's capability secret
    await expect(
      server.fetchEnvelopes(capMain.mailboxId, capPriv.capability)
    ).rejects.toThrow(/unauthorized/);
  });

  it('CROSS-SPACE STORAGE ISOLATION: Private session cannot access Main outbox or inbox', async () => {
    vault.createSpace({ name: 'Main', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: 'PassPriv', kdfParams: FAST_TEST_KDF_PARAMS });

    const mainSess = vault.unlockSpace('PassMain');
    const privSess = vault.unlockSpace('PassPriv');

    const capMain = generateMailboxCapability();
    const capPriv = generateMailboxCapability();
    await client.registerMailbox(mainSess, capMain);
    await client.registerMailbox(privSess, capPriv);

    // Enqueue message in Main Space outbox
    const env = createTransportEnvelope({
      mailboxId: capPriv.mailboxId,
      payload: 'OPAQUE_CIPHERTEXT_BLOB',
      sizeClass: 'SMALL',
    });

    // Make server offline so it stays in outbox
    server.simulateOffline = true;
    await client.sendEnvelope(mainSess, env, capPriv.mailboxId);
    server.simulateOffline = false;

    // Main has 1 item in outbox
    expect(client.getOutboxItems(mainSess).length).toBe(1);

    // Private Space outbox MUST BE EMPTY
    expect(client.getOutboxItems(privSess).length).toBe(0);
  });
});
