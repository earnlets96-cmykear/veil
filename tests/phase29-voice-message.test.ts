/**
 * Phase 29 Test Suite: Voice Messaging & Audio AEAD Encryption
 *
 * Validates:
 * 1. Client-side XChaCha20-Poly1305 audio encryption prior to upload.
 * 2. Uploading encrypted voice blob to S3 Object Storage via CloudClient.
 * 3. Downloading and decrypting audio bytes locally with ephemeral key.
 * 4. Negative test: corrupted ciphertext fails AEAD authentication.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_FILE = path.resolve(process.cwd(), '.veil_voice_test_db.json');

describe('Phase 29: Voice Messaging & Audio Encryption Pipeline', () => {
  let server: RelayServer;
  let port: number;
  let serverUrl: string;
  let cloudDb: SqlCloudDatabase;
  let objectStorage: S3ObjectStorage;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }

    port = 9200 + Math.floor(Math.random() * 600);
    serverUrl = `http://127.0.0.1:${port}`;

    cloudDb = new SqlCloudDatabase({ diskPath: TEST_DB_FILE });
    await cloudDb.init();

    objectStorage = new S3ObjectStorage({ bucket: 'veil-test-voice' });

    server = new RelayServer(
      {
        port,
        host: '127.0.0.1',
        authRequired: false,
        maxPayloadSizeBytes: 1024 * 1024,
        rateLimitMaxRequests: 10000,
        rateLimitWindowMs: 60000,
        cleanupIntervalMs: 60000,
        retentionHours: 24,
      },
      new MemoryRelayStore(),
      cloudDb,
      objectStorage
    );
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    await cloudDb.close();
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  it('encrypts voice note client-side, uploads to S3, and allows recipient decryption', async () => {
    const client = new CloudClient(serverUrl);
    await client.registerAccount({
      username: 'voice_sender',
      password: 'Password123!',
      deviceId: 'dev_sender',
    });

    const vault = new SpaceVaultManager();
    const spaceHeader = vault.createSpace({
      name: 'Voice Space',
      password: 'Password123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const session = vault.unlockSpace('Password123!', spaceHeader.spaceId);

    // Simulated 5-second audio bytes
    const sampleAudioBytes = new Uint8Array([79, 103, 103, 83, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 34, 45, 67, 89]);

    const voiceMeta = await VoiceRecorder.encryptAndUploadVoiceNote(
      session,
      client,
      sampleAudioBytes,
      5,
      'audio/ogg'
    );

    expect(voiceMeta.objectId).toBeDefined();
    expect(voiceMeta.encryptionKeyBase64).toBeDefined();
    expect(voiceMeta.nonceBase64).toBeDefined();
    expect(voiceMeta.durationSeconds).toBe(5);

    // Verify S3 contains ciphertext (NOT raw audio)
    const storedCiphertext = await objectStorage.download(voiceMeta.objectId);
    expect(storedCiphertext).not.toEqual(sampleAudioBytes);

    // Recipient decrypts ciphertext
    const key = base64ToBytes(voiceMeta.encryptionKeyBase64);
    const nonce = base64ToBytes(voiceMeta.nonceBase64);
    const aad = new TextEncoder().encode(`VEIL-VOICE-v1|spaceId:${session.spaceId}`);
    const decryptedAudio = decryptXChaCha20Poly1305(key, nonce, storedCiphertext, aad);

    expect(decryptedAudio).toEqual(sampleAudioBytes);
  });

  it('rejects tampered ciphertext during AEAD decryption', async () => {
    const client = new CloudClient(serverUrl);
    await client.registerAccount({
      username: 'voice_victim',
      password: 'Password123!',
      deviceId: 'dev_victim',
    });

    const vault = new SpaceVaultManager();
    const spaceHeader = vault.createSpace({
      name: 'Voice Space',
      password: 'Password123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const session = vault.unlockSpace('Password123!', spaceHeader.spaceId);

    const sampleAudio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const voiceMeta = await VoiceRecorder.encryptAndUploadVoiceNote(
      session,
      client,
      sampleAudio,
      2,
      'audio/webm'
    );

    const storedCiphertext = await objectStorage.download(voiceMeta.objectId);
    // Tamper with one byte of ciphertext
    storedCiphertext[0] ^= 0xff;

    const key = base64ToBytes(voiceMeta.encryptionKeyBase64);
    const nonce = base64ToBytes(voiceMeta.nonceBase64);

    expect(() => {
      decryptXChaCha20Poly1305(key, nonce, storedCiphertext);
    }).toThrow();
  });
});
