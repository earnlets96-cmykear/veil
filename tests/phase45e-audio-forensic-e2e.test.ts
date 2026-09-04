import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';

describe('Phase 45E: Audio Playback Forensic Verification (Tests A-F)', () => {
  let server: RelayServer;
  let serverUrl: string;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;
  let relayStore: MemoryRelayStore;

  let aliceClient: CloudClient;
  let bobClient: CloudClient;
  let malloryClient: CloudClient;

  let aliceSession: SpaceSession;
  let bobSession: SpaceSession;
  let mallorySession: SpaceSession;

  beforeEach(async () => {
    MediaCache.clear();
    cloudDb = new MemoryCloudDatabase();
    objectStorage = new LocalDiskObjectStorage();
    relayStore = new MemoryRelayStore();

    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      relayStore,
      cloudDb,
      objectStorage
    );
    const addr = await server.start();
    serverUrl = `http://127.0.0.1:${addr.port}`;

    aliceClient = new CloudClient(serverUrl);
    bobClient = new CloudClient(serverUrl);
    malloryClient = new CloudClient(serverUrl);

    await aliceClient.registerAccount({
      username: 'alice45e',
      password: 'AlicePassword123!',
      deviceId: 'device-alice',
    });

    await bobClient.registerAccount({
      username: 'bob45e',
      password: 'BobPassword123!',
      deviceId: 'device-bob',
    });

    await malloryClient.registerAccount({
      username: 'mallory45e',
      password: 'MalloryPassword123!',
      deviceId: 'device-mallory',
    });

    aliceSession = {
      spaceId: 'space_alice_45e',
      masterKey: new Uint8Array(32),
      name: 'Alice Space',
    } as any;

    bobSession = {
      spaceId: 'space_bob_45e',
      masterKey: new Uint8Array(32),
      name: 'Bob Space',
    } as any;

    mallorySession = {
      spaceId: 'space_mallory_45e',
      masterKey: new Uint8Array(32),
      name: 'Mallory Space',
    } as any;
  });

  afterEach(async () => {
    MediaCache.clear();
    await server.stop();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Test A: Short Audio (5-10s) Play -> Pause -> Play -> Seek
  // =========================================================================
  it('Test A: Short audio (5-10s) upload -> receive -> play -> pause -> play -> seek lifecycle', async () => {
    // 1. Generate 6-second synthetic audio bytes
    const audioData = new Uint8Array(2048);
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] = (i * 17) % 256;
    }

    // 2. Alice uploads voice note directly targeting Bob
    const meta = await VoiceRecorder.uploadVoiceNote(
      aliceSession,
      aliceClient,
      audioData,
      6, // 6 seconds duration
      'audio/webm',
      { recipientUsername: 'bob45e' }
    );

    expect(meta.objectId).toBeDefined();
    expect(meta.sizeBytes).toBe(2048);
    expect(meta.durationSeconds).toBe(6);

    // 3. Bob downloads voice note via downloadAndDecryptVoiceNote
    const blobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(bobSession, bobClient, meta);
    expect(blobUrl).toBeDefined();
    expect(blobUrl.startsWith('blob:')).toBe(true);

    // 4. Bob initializes player and starts playback
    const player = new VoicePlaybackManager();
    const progressUpdates: Array<{ pct: number; cur: number; dur: number }> = [];

    await player.playVoiceNote(bobSession, bobClient, meta, 'msg_short_01', {
      onProgress: (pct, cur, dur) => {
        progressUpdates.push({ pct, cur, dur });
      },
    });

    expect(player.isPlaying('msg_short_01')).toBe(true);
    expect(player.getStatus('msg_short_01')).toBe('playing');
    expect(player.getDuration()).toBe(6);

    // 5. Bob pauses audio
    player.pause();
    expect(player.isPlaying('msg_short_01')).toBe(false);
    expect(player.isPaused('msg_short_01')).toBe(true);
    expect(player.getStatus('msg_short_01')).toBe('paused');

    // 6. Bob resumes audio
    await player.resume();
    expect(player.isPlaying('msg_short_01')).toBe(true);
    expect(player.getStatus('msg_short_01')).toBe('playing');

    // 7. Bob seeks to 50% (3 seconds)
    player.seek(50, 'msg_short_01');
    expect(player.getCurrentTime()).toBe(3);

    player.stop();
    expect(player.getPlayingId()).toBeNull();
    expect(player.getStatus('msg_short_01')).toBe('idle');
  });

  // =========================================================================
  // Test B: Longer Audio (1-2m) Seek Middle -> Seek Near End -> Pause -> Resume
  // =========================================================================
  it('Test B: Longer audio (1-2m) start -> seek middle -> seek near end -> pause -> resume', async () => {
    // 90 seconds duration, 8KB payload
    const longAudioBytes = new Uint8Array(8192);
    for (let i = 0; i < longAudioBytes.length; i++) {
      longAudioBytes[i] = (i * 31) % 256;
    }

    const meta = await VoiceRecorder.uploadVoiceNote(
      aliceSession,
      aliceClient,
      longAudioBytes,
      90, // 90 seconds (1m 30s)
      'audio/webm',
      { recipientUsername: 'bob45e' }
    );

    const player = new VoicePlaybackManager();
    await player.playVoiceNote(bobSession, bobClient, meta, 'msg_long_01');

    expect(player.getDuration()).toBe(90);

    // Seek to middle (50% = 45s)
    player.seek(50, 'msg_long_01');
    expect(player.getCurrentTime()).toBe(45);

    // Seek near end (95% = 85.5s)
    player.seek(95, 'msg_long_01');
    expect(player.getCurrentTime()).toBe(85.5);

    // Pause while near end
    player.pause();
    expect(player.isPaused('msg_long_01')).toBe(true);
    expect(player.getCurrentTime()).toBe(85.5);

    // Resume from same position
    await player.resume();
    expect(player.isPlaying('msg_long_01')).toBe(true);
    expect(player.getCurrentTime()).toBe(85.5);

    player.stop();
  });

  // =========================================================================
  // Test C: App Restart & MediaCache Durability (Zero Network Refetch)
  // =========================================================================
  it('Test C: Audio fetched -> cached -> plays from MediaCache without network refetch', async () => {
    const audioData = new Uint8Array(1024);
    const meta = await VoiceRecorder.uploadVoiceNote(
      aliceSession,
      aliceClient,
      audioData,
      12,
      'audio/webm',
      { recipientUsername: 'bob45e' }
    );

    // Initial fetch from server
    const firstBlobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(bobSession, bobClient, meta);
    expect(firstBlobUrl).toBeDefined();

    // Verify item is present in MediaCache
    const cachedItem = MediaCache.get(meta.objectId);
    expect(cachedItem).toBeDefined();
    expect(cachedItem?.data.length).toBe(1024);

    // Spy on Bob's network client downloadAttachment
    const downloadSpy = vi.spyOn(bobClient, 'downloadAttachment');

    // Second fetch should resolve purely from cache with 0 network calls
    const secondBlobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(bobSession, bobClient, meta);
    expect(secondBlobUrl).toBeDefined();
    expect(downloadSpy).toHaveBeenCalledTimes(0);

    downloadSpy.mockRestore();
  });

  // =========================================================================
  // Test D: Rapid Controls Stress Test (Zero Promise Rejection / State Corruption)
  // =========================================================================
  it('Test D: Rapid sequence: play -> pause -> play -> pause -> seek -> play -> seek -> pause', async () => {
    const audioData = new Uint8Array(2048);
    const meta = await VoiceRecorder.uploadVoiceNote(
      aliceSession,
      aliceClient,
      audioData,
      25,
      'audio/webm',
      { recipientUsername: 'bob45e' }
    );

    const player = new VoicePlaybackManager();

    // Rapid concurrent-like sequence of interactions
    await player.playVoiceNote(bobSession, bobClient, meta, 'msg_stress_01');
    player.pause();
    await player.resume();
    player.pause();
    player.seek(20, 'msg_stress_01');
    await player.resume();
    player.seek(75, 'msg_stress_01');
    player.pause();

    // Verify final state is consistent and not corrupted
    expect(player.getStatus('msg_stress_01')).toBe('paused');
    expect(player.isPaused('msg_stress_01')).toBe(true);
    expect(player.isPlaying('msg_stress_01')).toBe(false);
    expect(player.getPlayingId()).toBe('msg_stress_01');
    expect(player.getCurrentTime()).toBe((75 / 100) * 25);

    player.stop();
  });

  // =========================================================================
  // Test E: Dual Accounts Bi-Directional Exchange & Unauthorized Access Denial
  // =========================================================================
  it('Test E: Bi-directional exchange (Alice -> Bob & Bob -> Alice) + Mallory access denial', async () => {
    const aliceAudio = new Uint8Array([1, 2, 3, 4, 5]);
    const bobAudio = new Uint8Array([6, 7, 8, 9, 10]);

    // Alice -> Bob
    const aliceMeta = await VoiceRecorder.uploadVoiceNote(
      aliceSession,
      aliceClient,
      aliceAudio,
      5,
      'audio/webm',
      { recipientUsername: 'bob45e' }
    );

    // Bob -> Alice
    const bobMeta = await VoiceRecorder.uploadVoiceNote(
      bobSession,
      bobClient,
      bobAudio,
      8,
      'audio/webm',
      { recipientUsername: 'alice45e' }
    );

    // Bob downloads Alice's note -> Success
    const bobDownloaded = await bobClient.downloadAttachment(aliceMeta.objectId);
    expect(bobDownloaded).toEqual(aliceAudio);

    // Alice downloads Bob's note -> Success
    const aliceDownloaded = await aliceClient.downloadAttachment(bobMeta.objectId);
    expect(aliceDownloaded).toEqual(bobAudio);

    // Mallory attempts to download Alice's note -> Access Denied (404)
    await expect(malloryClient.downloadAttachment(aliceMeta.objectId)).rejects.toThrow(
      /not found|access denied/i
    );

    // Mallory attempts to download Bob's note -> Access Denied (404)
    await expect(malloryClient.downloadAttachment(bobMeta.objectId)).rejects.toThrow(
      /not found|access denied/i
    );
  });

  // =========================================================================
  // Test F: HTTP Range & 206 Partial Content Byte Streaming
  // =========================================================================
  it('Test F: HTTP Range requests return 206 Partial Content and accurate byte slices', async () => {
    // 1000 bytes test payload
    const totalBytes = 1000;
    const testAudioBytes = new Uint8Array(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
      testAudioBytes[i] = i % 256;
    }

    const meta = await VoiceRecorder.uploadVoiceNote(
      aliceSession,
      aliceClient,
      testAudioBytes,
      30,
      'audio/webm',
      { recipientUsername: 'bob45e' }
    );

    // 1. Full download with Accept-Ranges check
    const fullRes = await fetch(`${serverUrl}/v1/cloud/attachments/download-raw/${meta.objectId}`, {
      headers: {
        Authorization: `Bearer ${bobClient.getSessionToken()}`,
      },
    });

    expect(fullRes.status).toBe(200);
    expect(fullRes.headers.get('Accept-Ranges')).toBe('bytes');
    expect(fullRes.headers.get('Content-Type')).toBe('audio/webm');
    expect(fullRes.headers.get('Content-Length')).toBe('1000');

    // 2. Range request: bytes 0-299 (first 300 bytes)
    const range1Res = await fetch(`${serverUrl}/v1/cloud/attachments/download-raw/${meta.objectId}`, {
      headers: {
        Authorization: `Bearer ${bobClient.getSessionToken()}`,
        Range: 'bytes=0-299',
      },
    });

    expect(range1Res.status).toBe(206);
    expect(range1Res.headers.get('Content-Range')).toBe('bytes 0-299/1000');
    expect(range1Res.headers.get('Content-Length')).toBe('300');
    expect(range1Res.headers.get('Accept-Ranges')).toBe('bytes');
    const range1Bytes = new Uint8Array(await range1Res.arrayBuffer());
    expect(range1Bytes.length).toBe(300);
    expect(range1Bytes).toEqual(testAudioBytes.slice(0, 300));

    // 3. Range request: bytes 300-599 (next 300 bytes)
    const range2Res = await fetch(`${serverUrl}/v1/cloud/attachments/download-raw/${meta.objectId}`, {
      headers: {
        Authorization: `Bearer ${bobClient.getSessionToken()}`,
        Range: 'bytes=300-599',
      },
    });

    expect(range2Res.status).toBe(206);
    expect(range2Res.headers.get('Content-Range')).toBe('bytes 300-599/1000');
    expect(range2Res.headers.get('Content-Length')).toBe('300');
    const range2Bytes = new Uint8Array(await range2Res.arrayBuffer());
    expect(range2Bytes.length).toBe(300);
    expect(range2Bytes).toEqual(testAudioBytes.slice(300, 600));

    // 4. Token via query parameter authentication for native browser <audio> tags
    const tokenParamRes = await fetch(
      `${serverUrl}/v1/cloud/attachments/download-raw/${meta.objectId}?token=${bobClient.getSessionToken()}`,
      {
        headers: {
          Range: 'bytes=600-999',
        },
      }
    );

    expect(tokenParamRes.status).toBe(206);
    expect(tokenParamRes.headers.get('Content-Range')).toBe('bytes 600-999/1000');
    const tokenBytes = new Uint8Array(await tokenParamRes.arrayBuffer());
    expect(tokenBytes.length).toBe(400);
    expect(tokenBytes).toEqual(testAudioBytes.slice(600, 1000));

    // 5. Unsatisfiable range request returns 416
    const invalidRangeRes = await fetch(`${serverUrl}/v1/cloud/attachments/download-raw/${meta.objectId}`, {
      headers: {
        Authorization: `Bearer ${bobClient.getSessionToken()}`,
        Range: 'bytes=5000-6000',
      },
    });

    expect(invalidRangeRes.status).toBe(416);
    expect(invalidRangeRes.headers.get('Content-Range')).toBe('bytes */1000');
  });
});
