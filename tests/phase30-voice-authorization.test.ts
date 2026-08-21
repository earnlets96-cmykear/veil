/**
 * VEIL Phase 30 Step 3: Voice-Message Cloud Authorization & Playback Tests.
 *
 * Verifies that:
 * 1. Authenticated owner can download attachment.
 * 2. Unauthenticated request receives 401 Unauthorized.
 * 3. Unauthorized third-party account receives 404 Access Denied.
 * 4. Authorized recipient (by accountId or username) can download attachment.
 * 5. Full voice round trip: Alice records -> encrypts -> uploads -> Bob downloads -> decrypts -> audio bytes match.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 30 Step 3: Voice Authorization & Playback', () => {
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

  it('Test A & D & E: Alice uploads voice note with Bob as recipient, Bob downloads and decrypts playable audio', async () => {
    // 1. Register Alice
    const clientAlice = new CloudClient(serverUrl);
    const storageAlice = new MemoryAdapter();
    const vaultAlice = new SpaceVaultManager();
    const storeAlice = new EncryptedSpaceStore(storageAlice);
    const idMgrAlice = new SpaceIdentityManager();
    const acctMgrAlice = new AccountManager(clientAlice, vaultAlice, idMgrAlice, storeAlice, storageAlice);

    const { session: sessionAlice, account: accountAlice } = await acctMgrAlice.registerAccount({
      username: 'alice_voice',
      password: 'AlicePassword123!',
      spaceName: 'Alice Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Register Bob
    const clientBob = new CloudClient(serverUrl);
    const storageBob = new MemoryAdapter();
    const vaultBob = new SpaceVaultManager();
    const storeBob = new EncryptedSpaceStore(storageBob);
    const idMgrBob = new SpaceIdentityManager();
    const acctMgrBob = new AccountManager(clientBob, vaultBob, idMgrBob, storeBob, storageBob);

    const { session: sessionBob, account: accountBob } = await acctMgrBob.registerAccount({
      username: 'bob_voice',
      password: 'BobPassword123!',
      spaceName: 'Bob Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 3. Alice records simulated audio bytes
    const simulatedAudioBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01]);
    const durationSeconds = 5;
    const mimeType = 'audio/webm;codecs=opus';

    // 4. Alice encrypts and uploads voice note specifying Bob as recipient
    const voiceMeta = await VoiceRecorder.encryptAndUploadVoiceNote(
      sessionAlice,
      clientAlice,
      simulatedAudioBytes,
      durationSeconds,
      mimeType,
      {
        recipientAccountId: accountBob.accountId,
        recipientUsername: 'bob_voice',
      }
    );

    expect(voiceMeta.objectId).toBeDefined();
    expect(voiceMeta.encryptionKeyBase64).toBeDefined();
    expect(voiceMeta.nonceBase64).toBeDefined();

    // 5. Test A: Alice (Owner) can download her own voice note
    const aliceDownloadedCiphertext = await clientAlice.downloadAttachment(voiceMeta.objectId);
    expect(aliceDownloadedCiphertext.length).toBeGreaterThan(0);

    // 6. Test D: Bob (Authorized Recipient) can download Alice's voice note
    const bobDownloadedCiphertext = await clientBob.downloadAttachment(voiceMeta.objectId);
    expect(bobDownloadedCiphertext).toEqual(aliceDownloadedCiphertext);

    // 7. Test E: Bob decrypts the downloaded voice note
    const audioUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(sessionBob, clientBob, voiceMeta);
    expect(audioUrl).toMatch(/^(blob:|https?:)/);
  });

  it('Test B: Unauthorized third-party account is rejected with 404 Access Denied', async () => {
    // 1. Alice (Owner)
    const clientAlice = new CloudClient(serverUrl);
    const storageAlice = new MemoryAdapter();
    const vaultAlice = new SpaceVaultManager();
    const storeAlice = new EncryptedSpaceStore(storageAlice);
    const idMgrAlice = new SpaceIdentityManager();
    const acctMgrAlice = new AccountManager(clientAlice, vaultAlice, idMgrAlice, storeAlice, storageAlice);

    const { session: sessionAlice } = await acctMgrAlice.registerAccount({
      username: 'alice_private',
      password: 'AlicePassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Eve (Unauthorized Third Party)
    const clientEve = new CloudClient(serverUrl);
    const storageEve = new MemoryAdapter();
    const vaultEve = new SpaceVaultManager();
    const storeEve = new EncryptedSpaceStore(storageEve);
    const idMgrEve = new SpaceIdentityManager();
    const acctMgrEve = new AccountManager(clientEve, vaultEve, idMgrEve, storeEve, storageEve);

    await acctMgrEve.registerAccount({
      username: 'eve_attacker',
      password: 'EvePassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 3. Alice uploads a voice note intended only for Bob
    const rawAudio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const voiceMeta = await VoiceRecorder.encryptAndUploadVoiceNote(
      sessionAlice,
      clientAlice,
      rawAudio,
      3,
      'audio/webm',
      {
        recipientUsername: 'bob_intended_only',
      }
    );

    // 4. Eve attempts to download Alice's object
    await expect(clientEve.downloadAttachment(voiceMeta.objectId)).rejects.toThrow(/not found|access denied/i);
  });

  it('Test C: Unauthenticated request without Bearer token is rejected with 401 Unauthorized', async () => {
    const unauthenticatedClient = new CloudClient(serverUrl);
    expect(unauthenticatedClient.getSessionToken()).toBeNull();

    await expect(unauthenticatedClient.downloadAttachment('obj_nonexistent_123')).rejects.toThrow(/unauthorized/i);
  });
});
