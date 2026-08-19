/**
 * VEIL Phase 27: Local-to-Cloud Migration Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SyncEngine } from '../src/sync/syncEngine.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { StorageMigrationManager } from '../src/storage/cloudMigration.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { bytesToBase64, base64ToBytes, randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 27: Local Storage to Cloud Migration', () => {
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

  it('LOCAL-TO-CLOUD MIGRATION: Migrates local-only data, preserves local cache, and enables cloud recovery', async () => {
    // 1. Setup local space with existing messages (prior to cloud account creation)
    const localStore = new EncryptedSpaceStore();
    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'MigrationSpace', password: 'SpacePassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('SpacePassword123!', env.spaceId);

    const convKey = randomBytes(32);
    // Write 5 local messages to local store
    for (let i = 1; i <= 5; i++) {
      const plaintext = new TextEncoder().encode(`Local legacy message #${i}`);
      const enc = encryptXChaCha20Poly1305(convKey, plaintext);

      localStore.set(session, `veil:chat:peer_bob:${i}`, {
        messageId: `legacy_msg_${i}`,
        conversationId: 'peer_bob',
        ciphertext: bytesToBase64(enc.ciphertext),
        nonce: bytesToBase64(enc.nonce),
        version: i,
        timestamp: Date.now() + i,
      });
    }

    // 2. Establish Cloud Account
    const client = new CloudClient({ baseUrl: serverUrl });
    await client.registerAccount({
      username: '@migrated_user',
      password: 'CloudAccountPassword123!',
      deviceId: 'initial_device',
    });

    const syncEngine = new SyncEngine(localStore, client);
    const migrationMgr = new StorageMigrationManager(localStore, client, syncEngine);

    // 3. Execute Migration
    const summary = await migrationMgr.migrateSpaceToCloud(session, bytesToBase64(new TextEncoder().encode('ENCRYPTED_SPACE_HEADER')));
    expect(summary.completed).toBe(true);
    expect(summary.messagesUploaded).toBe(5);

    // 4. Verify local data is still completely intact
    for (let i = 1; i <= 5; i++) {
      const rec = localStore.get<any>(session, `veil:chat:peer_bob:${i}`);
      expect(rec).not.toBeNull();
      expect(rec.messageId).toBe(`legacy_msg_${i}`);
    }

    // 5. Simulate clearing local storage / new device installation
    const freshClient = new CloudClient({ baseUrl: serverUrl });
    await freshClient.loginAccount({
      username: '@migrated_user',
      password: 'CloudAccountPassword123!',
      deviceId: 'secondary_device',
    });

    const freshStore = new EncryptedSpaceStore();
    const freshSyncEngine = new SyncEngine(freshStore, freshClient);

    // Pull from cloud
    const pullRes = await freshSyncEngine.sync(session);
    expect(pullRes.pulled).toBe(5);

    const recovered = freshSyncEngine.getMessagesForConversation(session, 'peer_bob');
    expect(recovered.length).toBe(5);

    for (let i = 1; i <= 5; i++) {
      const msg = recovered[i - 1];
      const dec = decryptXChaCha20Poly1305(convKey, base64ToBytes(msg.nonce), base64ToBytes(msg.encryptedPayload));
      expect(new TextDecoder().decode(dec)).toBe(`Local legacy message #${i}`);
    }
  });
});
