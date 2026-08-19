/**
 * VEIL Phase 27: Cloud Message Persistence & Sync Engine Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SyncEngine } from '../src/sync/syncEngine.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { bytesToBase64, base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 27: Cloud Message Persistence & Sync Engine', () => {
  let server: RelayServer;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;
  let serverUrl: string;

  beforeEach(async () => {
    cloudDb = new MemoryCloudDatabase();
    objectStorage = new LocalDiskObjectStorage();
    const relayStore = new MemoryRelayStore();

    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      relayStore,
      cloudDb,
      objectStorage
    );

    const addr = await server.start();
    serverUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('MULTI-DEVICE SYNC: Device A pushes encrypted messages, Device B pulls & decrypts locally', async () => {
    const clientA = new CloudClient({ baseUrl: serverUrl });
    const clientB = new CloudClient({ baseUrl: serverUrl });

    // 1. Account Setup
    await clientA.registerAccount({
      username: '@sync_alice',
      password: 'SyncPassword123!',
      deviceId: 'alice_device_a',
      deviceName: 'Device A',
    });

    await clientB.loginAccount({
      username: '@sync_alice',
      password: 'SyncPassword123!',
      deviceId: 'alice_device_b',
      deviceName: 'Device B',
    });

    // 2. Space Setup (same Space Master Key / password on both devices)
    const vaultA = new SpaceVaultManager();
    const envA = vaultA.createSpace({ name: 'WorkSpace', password: 'SpacePassword!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vaultA.unlockSpace('SpacePassword!', envA.spaceId);
    const storeA = new EncryptedSpaceStore();
    const syncEngineA = new SyncEngine(storeA, clientA);

    const vaultB = new SpaceVaultManager();
    vaultB.registerEnvelope(envA);
    const sessionB = vaultB.unlockSpace('SpacePassword!', envA.spaceId);
    const storeB = new EncryptedSpaceStore();
    const syncEngineB = new SyncEngine(storeB, clientB);

    // 3. Device A creates and enqueues 5 encrypted messages
    const convKey = new Uint8Array(32).fill(7); // Symmetric conversation key
    for (let i = 1; i <= 5; i++) {
      const plaintext = new TextEncoder().encode(`Message #${i} from Device A`);
      const enc = encryptXChaCha20Poly1305(convKey, plaintext);

      syncEngineA.enqueueMessage(sessionA, {
        messageId: `msg_${i}`,
        accountId: clientA.getAccountId()!,
        spaceId: sessionA.spaceId,
        conversationId: 'peer_bob',
        senderDeviceId: 'alice_device_a',
        encryptedPayload: bytesToBase64(enc.ciphertext),
        nonce: bytesToBase64(enc.nonce),
        version: i,
        createdAt: Date.now() + i,
        updatedAt: Date.now() + i,
      });
    }

    // 4. Device A syncs (pushes to cloud)
    const syncResA = await syncEngineA.sync(sessionA);
    expect(syncResA.pushed).toBe(5);

    // 5. Device B syncs (pulls from cloud)
    const syncResB = await syncEngineB.sync(sessionB);
    expect(syncResB.pulled).toBe(5);

    // 6. Device B retrieves and decrypts from its local cache
    const cachedB = syncEngineB.getMessagesForConversation(sessionB, 'peer_bob');
    expect(cachedB.length).toBe(5);

    for (let i = 1; i <= 5; i++) {
      const msg = cachedB[i - 1];
      const dec = decryptXChaCha20Poly1305(
        convKey,
        base64ToBytes(msg.nonce),
        base64ToBytes(msg.encryptedPayload)
      );
      expect(new TextDecoder().decode(dec)).toBe(`Message #${i} from Device A`);
    }
  });

  it('TOMBSTONES & DELETIONS: Propagates deletions across devices via versioned tombstones', async () => {
    const clientA = new CloudClient({ baseUrl: serverUrl });
    const clientB = new CloudClient({ baseUrl: serverUrl });

    await clientA.registerAccount({
      username: '@tombstone_user',
      password: 'Password123!',
      deviceId: 'dev_a',
    });
    await clientB.loginAccount({
      username: '@tombstone_user',
      password: 'Password123!',
      deviceId: 'dev_b',
    });

    const vaultA = new SpaceVaultManager();
    const env = vaultA.createSpace({ name: 'SecretSpace', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vaultA.unlockSpace('Pass', env.spaceId);

    const vaultB = new SpaceVaultManager();
    vaultB.registerEnvelope(env);
    const sessionB = vaultB.unlockSpace('Pass', env.spaceId);

    const storeA = new EncryptedSpaceStore();
    const syncA = new SyncEngine(storeA, clientA);
    const storeB = new EncryptedSpaceStore();
    const syncB = new SyncEngine(storeB, clientB);

    // Enqueue & push message
    syncA.enqueueMessage(sessionA, {
      messageId: 'msg_to_delete',
      accountId: clientA.getAccountId()!,
      spaceId: sessionA.spaceId,
      conversationId: 'chat_1',
      senderDeviceId: 'dev_a',
      encryptedPayload: 'ENCRYPTED_TEXT',
      nonce: 'NONCE',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await syncA.sync(sessionA);

    // Device B pulls message
    await syncB.sync(sessionB);
    expect(syncB.getMessagesForConversation(sessionB, 'chat_1').length).toBe(1);

    // Device A deletes message and syncs
    syncA.markMessageDeleted(sessionA, 'msg_to_delete');
    await syncA.sync(sessionA);

    // Device B pulls updates
    await syncB.sync(sessionB);

    // Message is tombstoned and filtered out of active conversation view on Device B
    expect(syncB.getMessagesForConversation(sessionB, 'chat_1').length).toBe(0);
  });
});
