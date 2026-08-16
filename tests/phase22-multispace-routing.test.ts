import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

import { SpaceSession } from '../src/spaces/session.ts';
import { PrekeyBundle } from '../src/ratchet/types.ts';
import { SpaceMailboxBinding } from '../src/network/types.ts';

describe('VEIL Phase 22: Multi-Space Cryptographic Isolation Tests', () => {
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

  it('maintains absolute cryptographic and routing isolation across 5 distinct Spaces', async () => {
    const netConfig = {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    };

    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const net = new NetworkManager(store, netConfig);
    const prekeys = new PrekeyManager(store, idMgr);
    const conv = new ConversationManager(store, idMgr, prekeys);

    const spaceNames = ['Main', 'Work', 'Finance', 'Private', 'Decoy'];
    const sessions: SpaceSession[] = [];
    const mailboxes: SpaceMailboxBinding[] = [];
    const bundles: PrekeyBundle[] = [];

    for (let i = 0; i < 5; i++) {
      const env = vault.createSpace({
        name: spaceNames[i],
        password: `PasswordSpace${i}!`,
        kdfParams: FAST_TEST_KDF_PARAMS,
      });
      const session = vault.unlockSpace(`PasswordSpace${i}!`, env.spaceId);
      sessions.push(session);

      idMgr.createIdentity(session, store);
      prekeys.generateSignedPrekey(session);
      prekeys.generateOneTimePrekeys(session, 5);
      bundles.push(prekeys.createPrekeyBundle(session));

      const mb = await net.getOrCreateMailbox(session);
      mailboxes.push(mb);
    }

    // Verify all 5 mailboxes are distinct
    const mbIds = mailboxes.map((m) => m.mailboxId);
    const uniqueMbIds = new Set(mbIds);
    expect(uniqueMbIds.size).toBe(5);

    // Send a message from Space 0 (Main) to Space 1 (Work)
    const msgMainToWork = 'Classified message from Main to Work';
    const { wirePayloadBase64: wire1 } = await conv.encryptAndPackWireMessage(
      sessions[0],
      bundles[1],
      msgMainToWork
    );
    await net.sendEnvelope(sessions[0], mailboxes[1].mailboxId, wire1);

    // Space 2 (Finance), Space 3 (Private), Space 4 (Decoy) sync their mailboxes -> 0 messages
    for (let i = 2; i < 5; i++) {
      const count = await net.syncMailbox(sessions[i]);
      expect(count).toBe(0);
      expect(conv.getMessages(sessions[i], bundles[0].identityDocument.identityId)).toHaveLength(0);
    }

    // Space 1 (Work) syncs -> exactly 1 message received and decrypted
    let receivedWorkMsg = '';
    const workProcessed = await net.syncMailbox(sessions[1], async (payload) => {
      const res = await conv.processInboundWirePayload(sessions[1], payload);
      receivedWorkMsg = res.storedMessage.text;
    });
    expect(workProcessed).toBe(1);
    expect(receivedWorkMsg).toBe(msgMainToWork);
  });
});
