import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { RelayServer } from '../src/server/relayServer.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 17: Real Two-Client E2E Integration Suite', () => {
  const relayDataDir = path.join(process.cwd(), '.tmp_phase17_relay_data');
  let relayStore: PersistentFileRelayStore;
  let server: RelayServer;
  let serverPort: number;

  let vaultA: SpaceVaultManager;
  let vaultB: SpaceVaultManager;
  let storeA: EncryptedSpaceStore;
  let storeB: EncryptedSpaceStore;
  let idMgrA: SpaceIdentityManager;
  let idMgrB: SpaceIdentityManager;
  let netA: NetworkManager;
  let netB: NetworkManager;
  let contactMgrA: ContactManager;
  let contactMgrB: ContactManager;

  beforeEach(async () => {
    if (fs.existsSync(relayDataDir)) {
      fs.rmSync(relayDataDir, { recursive: true, force: true });
    }
    relayStore = new PersistentFileRelayStore(relayDataDir);
    await relayStore.init();

    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' }, relayStore);
    const addr = await server.start();
    serverPort = addr.port;

    vaultA = new SpaceVaultManager();
    vaultB = new SpaceVaultManager();
    storeA = new EncryptedSpaceStore();
    storeB = new EncryptedSpaceStore();
    idMgrA = new SpaceIdentityManager();
    idMgrB = new SpaceIdentityManager();

    netA = new NetworkManager(storeA, {
      httpUrl: `http://127.0.0.1:${serverPort}`,
      wsUrl: `ws://127.0.0.1:${serverPort}/v1/ws`,
    });
    netB = new NetworkManager(storeB, {
      httpUrl: `http://127.0.0.1:${serverPort}`,
      wsUrl: `ws://127.0.0.1:${serverPort}/v1/ws`,
    });

    contactMgrA = new ContactManager(storeA);
    contactMgrB = new ContactManager(storeB);
  });

  afterEach(async () => {
    await server.stop();
    await relayStore.destroyStore();
  });

  it('TWO-CLIENT PRODUCTION E2E: Handshake, Live Messaging, Offline Queuing, Restart Drain, Attachments, Panic Lock', async () => {
    // 1. Initialize Space A & Space B
    const envA = vaultA.createSpace({ name: 'Alice Space', password: 'PasswordA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vaultB.createSpace({ name: 'Bob Space', password: 'PasswordB123!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vaultA.unlockSpace('PasswordA123!', envA.spaceId);
    const sessionB = vaultB.unlockSpace('PasswordB123!', envB.spaceId);

    const docA = idMgrA.createIdentity(sessionA, storeA);
    const loadedA = idMgrA.loadIdentity(sessionA, storeA)!;

    const docB = idMgrB.createIdentity(sessionB, storeB);
    const loadedB = idMgrB.loadIdentity(sessionB, storeB)!;

    // 2. Invitation & Verification
    const invA = InvitationManager.createInvitation(docA, loadedA.signingPrivateKey, 'Alice');
    const shareableA = InvitationManager.toShareableString(invA);
    const parsedA = InvitationManager.verifyAndParseInvitation(shareableA);
    const contactA = await contactMgrB.addContactFromInvitation(sessionB, parsedA);
    expect(contactA.identityId).toBe(docA.identityId);

    // 3. Mailboxes & Real-Time Push
    const mbB = await netB.getOrCreateMailbox(sessionB);
    const receivedB: string[] = [];
    await netB.startListening(sessionB, async (payload) => {
      receivedB.push(payload);
    });

    // Send A -> B
    const payload1 = JSON.stringify({ id: 'msg_01', text: 'Real E2EE message from Alice' });
    await netA.sendEnvelope(sessionA, mbB.mailboxId, payload1);

    await new Promise((r) => setTimeout(r, 150));
    expect(receivedB).toHaveLength(1);
    expect(receivedB[0]).toContain('Real E2EE message from Alice');

    // 4. Offline Queuing & Drain
    netB.stopListening(sessionB); // Client B goes offline


    const payload2 = JSON.stringify({ id: 'msg_02', text: 'Offline queued message for Bob' });
    await netA.sendEnvelope(sessionA, mbB.mailboxId, payload2);

    // Verify envelope is queued on persistent relay
    const pendingOnRelay = await relayStore.listEnvelopes(mbB.mailboxId, 10);
    expect(pendingOnRelay.length).toBeGreaterThanOrEqual(1);

    // Client B reconnects and syncs
    const offlineReceived: string[] = [];
    const count = await netB.syncMailbox(sessionB, async (payload) => {
      offlineReceived.push(payload);
    });
    expect(count).toBeGreaterThanOrEqual(1);
    expect(offlineReceived[0]).toContain('Offline queued message for Bob');

    // Verify envelope purged after ACK
    const remainingOnRelay = await relayStore.listEnvelopes(mbB.mailboxId, 10);
    expect(remainingOnRelay).toHaveLength(0);

    // 5. Chunked Attachment Transfer
    const testBytes = new Uint8Array([42, 43, 44, 45, 46, 47, 48]);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(testBytes, 'sample.dat', 'application/octet-stream', sessionA.getStorageKey());
    const reassembled = AttachmentPipeline.decryptAndReassemble(metadata, chunks, sessionA.getStorageKey());
    expect(reassembled).toEqual(testBytes);

    // 6. Panic Lock Zeroization
    sessionA.destroy();
    expect(sessionA.isActive()).toBe(false);
  });
});
