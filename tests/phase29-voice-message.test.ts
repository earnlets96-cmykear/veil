/**
 * Phase 29 Test Suite: Voice Messaging & Authorized Media Pipeline
 *
 * Validates:
 * 1. Uploading voice note to S3/R2 object storage with integrity hashing.
 * 2. Authorized recipient access and blob URL generation via downloadAndDecryptVoiceNote.
 * 3. HTTP Range 206 partial content streaming for native seek support.
 * 4. Negative test: unauthorized third-party access is rejected (403 Forbidden).
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
import { MediaCache } from '../src/ui/utils/mediaCache.ts';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_FILE = path.resolve(process.cwd(), '.veil_voice_test_db.json');

describe('Phase 29: Voice Messaging & Authorized Media Pipeline', () => {
  let server: RelayServer;
  let port: number;
  let serverUrl: string;
  let cloudDb: SqlCloudDatabase;
  let objectStorage: S3ObjectStorage;

  beforeEach(async () => {
    MediaCache.clear();
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
    MediaCache.clear();
    await server.stop();
    await cloudDb.close();
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  it('uploads voice note to S3, verifies integrity, and allows authorized recipient access', async () => {
    const senderClient = new CloudClient(serverUrl);
    await senderClient.registerAccount({
      username: 'voice_sender',
      password: 'Password123!',
      deviceId: 'dev_sender',
    });

    const recipientClient = new CloudClient(serverUrl);
    await recipientClient.registerAccount({
      username: 'voice_recipient',
      password: 'Password123!',
      deviceId: 'dev_recipient',
    });

    const vault = new SpaceVaultManager();
    const senderHeader = vault.createSpace({
      name: 'Sender Space',
      password: 'Password123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const senderSession = vault.unlockSpace('Password123!', senderHeader.spaceId);

    const recipientHeader = vault.createSpace({
      name: 'Recipient Space',
      password: 'Password123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const recipientSession = vault.unlockSpace('Password123!', recipientHeader.spaceId);

    // Simulated 18-byte audio stream
    const sampleAudioBytes = new Uint8Array([79, 103, 103, 83, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 34, 45, 67, 89]);

    const voiceMeta = await VoiceRecorder.uploadVoiceNote(
      senderSession,
      senderClient,
      sampleAudioBytes,
      5,
      'audio/ogg',
      { recipientUsername: 'voice_recipient' }
    );

    expect(voiceMeta.objectId).toBeDefined();
    expect(voiceMeta.durationSeconds).toBe(5);
    expect(voiceMeta.sizeBytes).toBe(sampleAudioBytes.length);

    // Verify S3 contains exact stored bytes
    const storedBytes = await objectStorage.download(voiceMeta.objectId);
    expect(storedBytes).toEqual(sampleAudioBytes);

    // Authorized recipient downloads voice note
    const blobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(
      recipientSession,
      recipientClient,
      voiceMeta
    );
    expect(blobUrl).toBeDefined();
    expect(blobUrl.startsWith('blob:')).toBe(true);

    // Verify HTTP Range 206 streaming for seeking
    const rangeRes = await fetch(`${serverUrl}/v1/cloud/attachments/download-raw/${voiceMeta.objectId}`, {
      headers: {
        Authorization: `Bearer ${recipientClient.getSessionToken()}`,
        Range: 'bytes=0-7',
      },
    });
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get('Content-Range')).toBe(`bytes 0-7/${sampleAudioBytes.length}`);
    const rangeBuffer = new Uint8Array(await rangeRes.arrayBuffer());
    expect(rangeBuffer.length).toBe(8);
    expect(rangeBuffer).toEqual(sampleAudioBytes.slice(0, 8));
  });

  it('rejects unauthorized third-party access to voice note', async () => {
    const senderClient = new CloudClient(serverUrl);
    await senderClient.registerAccount({
      username: 'voice_sender_sec',
      password: 'Password123!',
      deviceId: 'dev_sender_sec',
    });

    const attackerClient = new CloudClient(serverUrl);
    await attackerClient.registerAccount({
      username: 'voice_attacker',
      password: 'Password123!',
      deviceId: 'dev_attacker',
    });

    const vault = new SpaceVaultManager();
    const senderHeader = vault.createSpace({
      name: 'Sender Space',
      password: 'Password123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const senderSession = vault.unlockSpace('Password123!', senderHeader.spaceId);

    const sampleAudio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const voiceMeta = await VoiceRecorder.uploadVoiceNote(
      senderSession,
      senderClient,
      sampleAudio,
      2,
      'audio/webm',
      { recipientUsername: 'voice_authorized_user' }
    );

    // Attacker attempts to download attachment directly
    await expect(
      attackerClient.downloadAttachment(voiceMeta.objectId)
    ).rejects.toThrow();

    // Attacker HTTP fetch receives 404/403 (anti-enumeration / access denied)
    const rawRes = await fetch(`${serverUrl}/v1/cloud/attachments/download-raw/${voiceMeta.objectId}`, {
      headers: {
        Authorization: `Bearer ${attackerClient.getSessionToken()}`,
      },
    });
    expect([403, 404]).toContain(rawRes.status);
  });
});
