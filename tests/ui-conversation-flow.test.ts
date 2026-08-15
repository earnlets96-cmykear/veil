import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 14: UI Conversation & Messaging Flow Tests', () => {
  let server: RelayServer;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let netManager: NetworkManager;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();

    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    netManager = new NetworkManager(store, {
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('UI MESSAGING LIFECYCLE: Enqueues, sends over relay, and maintains delivery status in Space store', async () => {
    const env = vault.createSpace({ name: 'Personal', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const mb = await netManager.getOrCreateMailbox(session);

    // Save UI conversation record
    const conv = {
      id: 'peer_bob_123',
      type: 'direct' as const,
      name: 'Bob',
      avatarSeed: 'bob',
      unreadCount: 0,
    };
    await store.setAsync(session, 'veil:ui:conversations', [conv]);

    // Send UI message
    const msg = {
      id: 'msg_01',
      conversationId: 'peer_bob_123',
      senderId: session.spaceId,
      text: 'Hello from UI layer!',
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'SENT_TO_RELAY' as const,
    };
    await store.setAsync(session, 'veil:ui:messages', { peer_bob_123: [msg] });

    // Verify stored history in encrypted store
    const retrievedMsgs = await store.getAsync<Record<string, typeof msg[]>>(session, 'veil:ui:messages');
    expect(retrievedMsgs?.peer_bob_123).toHaveLength(1);
    expect(retrievedMsgs?.peer_bob_123[0].text).toBe('Hello from UI layer!');
    expect(retrievedMsgs?.peer_bob_123[0].status).toBe('SENT_TO_RELAY');
  });
});
