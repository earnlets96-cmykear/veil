import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { inferMediaMime } from '../src/attachments/mimeUtils.ts';
import { randomBytes, bytesToBase64, bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { CloudHandler } from '../src/server/cloud/cloudHandler.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { IObjectStorage, ObjectMetadata } from '../src/server/cloud/storage/types.ts';
import { AccountService } from '../src/server/cloud/accountService.ts';
import { CloudClient } from '../src/network/cloudClient.ts';

class TestMemoryObjectStorage implements IObjectStorage {
  private map = new Map<string, { data: Uint8Array; meta: ObjectMetadata }>();

  async init(): Promise<void> {}
  async close(): Promise<void> {
    this.map.clear();
  }

  async upload(objectId: string, data: Uint8Array, customMetadata?: Record<string, string>): Promise<ObjectMetadata> {
    const meta: ObjectMetadata = {
      objectId,
      sizeBytes: data.length,
      sha256Hash: bytesToHex(sha256(data)),
      createdAt: Date.now(),
      customMetadata,
    };
    this.map.set(objectId, { data, meta });
    return meta;
  }

  async download(objectId: string): Promise<Uint8Array | null> {
    const entry = this.map.get(objectId);
    return entry ? entry.data : null;
  }

  async delete(objectId: string): Promise<boolean> {
    return this.map.delete(objectId);
  }

  async exists(objectId: string): Promise<boolean> {
    return this.map.has(objectId);
  }

  async getMetadata(objectId: string): Promise<ObjectMetadata | null> {
    const entry = this.map.get(objectId);
    return entry ? entry.meta : null;
  }
}

describe('Phase 53: Video Upload & Pipeline Regression Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let cloudClient: CloudClient;
  let testAccountId: string;
  let testSessionToken: string;

  beforeAll(async () => {
    const db = new MemoryCloudDatabase();
    await db.init();
    const storage = new TestMemoryObjectStorage();
    await storage.init();
    const accountService = new AccountService(db);
    const handler = new CloudHandler(db, storage, accountService);

    server = http.createServer(async (req, res) => {
      const handled = await handler.handleRequest(req, res);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
    cloudClient = new CloudClient(baseUrl);

    // Register a test account
    const regRes = await cloudClient.registerAccount({
      username: 'videotester',
      password: 'VideoPassword123!',
      deviceId: 'dev_test_videouploader123',
      deviceName: 'Video Device',
    });
    testAccountId = regRes.account.accountId;
    testSessionToken = regRes.session.sessionToken;
    cloudClient.setSession(testSessionToken, testAccountId, regRes.device.deviceId);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('1. Robust Video MIME Inference & Sanitization', () => {
    it('sanitizes MIME types with parameters', () => {
      expect(inferMediaMime({ name: 'clip.mp4', type: 'video/mp4; codecs="avc1.42E01E"' })).toBe('video/mp4');
      expect(inferMediaMime({ name: 'clip.webm', type: 'video/webm; codecs="vp9"' })).toBe('video/webm');
    });

    it('infers correct video MIME types from extension when browser MIME is empty or octet-stream', () => {
      expect(inferMediaMime({ name: 'holiday.mp4', type: '' })).toBe('video/mp4');
      expect(inferMediaMime({ name: 'holiday.mov', type: 'application/octet-stream' })).toBe('video/quicktime');
      expect(inferMediaMime({ name: 'holiday.webm', type: 'binary/octet-stream' })).toBe('video/webm');
      expect(inferMediaMime({ name: 'holiday.mkv', type: '' })).toBe('video/x-matroska');
      expect(inferMediaMime({ name: 'holiday.avi', type: 'application/octet-stream' })).toBe('video/x-msvideo');
      expect(inferMediaMime({ name: 'holiday.3gp', type: '' })).toBe('video/3gpp');
    });

    it('detects video format via magic byte signatures when extension is absent or generic', () => {
      // MP4 ftyp box: bytes 4-8 = 'ftyp', 8-12 = 'isom'
      const mp4Header = new Uint8Array(16);
      mp4Header.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
      expect(inferMediaMime({ name: 'unknown_video', type: 'application/octet-stream' }, mp4Header)).toBe('video/mp4');

      // QuickTime ftyp box: bytes 4-8 = 'ftyp', 8-12 = 'qt  '
      const movHeader = new Uint8Array(16);
      movHeader.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
      expect(inferMediaMime({ name: 'unknown_video', type: 'application/octet-stream' }, movHeader)).toBe('video/quicktime');

      // WebM EBML header: 0x1A, 0x45, 0xDF, 0xA3
      const webmHeader = new Uint8Array(16);
      webmHeader.set([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(inferMediaMime({ name: 'unknown_video', type: 'application/octet-stream' }, webmHeader)).toBe('video/webm');

      // AVI RIFF header: 'RIFF' .... 'AVI '
      const aviHeader = new Uint8Array(16);
      aviHeader.set([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0, 0, 0, 0,
        0x41, 0x56, 0x49, 0x20, // AVI 
      ]);
      expect(inferMediaMime({ name: 'unknown_video', type: 'application/octet-stream' }, aviHeader)).toBe('video/x-msvideo');
    });
  });

  describe('2. Direct Binary Streaming Upload & Download (No Double-Base64 Explosion)', () => {
    it('uploads encrypted video via raw binary stream and downloads byte-for-byte identical ciphertext', async () => {
      // 1. Generate simulated video payload (1.5 MB)
      const originalVideo = new Uint8Array(1.5 * 1024 * 1024);
      for (let i = 0; i < originalVideo.length; i++) {
        originalVideo[i] = (i * 31) & 0xff;
      }

      const ephemeralKey = randomBytes(32);
      const attachmentId = `att_video_${Date.now()}`;

      // 2. Client-side encryption & chunking
      const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
        originalVideo,
        'action_shot.mp4',
        'video/mp4',
        ephemeralKey,
        undefined,
        attachmentId
      );

      const rawCiphertext = new TextEncoder().encode(JSON.stringify(chunks));
      const ciphertextHash = bytesToHex(sha256(rawCiphertext));

      // 3. Create attachment entity on server
      const createRes = await cloudClient.createAttachment({
        attachmentId,
        spaceId: 'spc_test_video',
        ciphertextHash,
        ciphertextSize: rawCiphertext.length,
        mimeType: 'video/mp4',
        encryptedMetadata: JSON.stringify({
          name: 'action_shot.mp4',
          recipientAccountId: testAccountId,
        }),
      });

      const objectId = createRes.attachment.objectId;
      expect(objectId).toBeDefined();

      // 4. Upload raw binary via application/octet-stream
      await cloudClient.uploadAttachment(objectId, rawCiphertext);

      // 5. Download raw binary via application/octet-stream
      const downloadedCiphertext = await cloudClient.downloadAttachment(objectId);
      expect(downloadedCiphertext.length).toBe(rawCiphertext.length);
      expect(bytesToHex(sha256(downloadedCiphertext))).toBe(ciphertextHash);

      // 6. Decrypt on recipient side
      const downloadedChunks = JSON.parse(new TextDecoder().decode(downloadedCiphertext));
      const decryptedVideo = AttachmentPipeline.decryptAndReassemble(metadata, downloadedChunks, ephemeralKey);

      expect(decryptedVideo.length).toBe(originalVideo.length);
      expect(bytesToHex(sha256(decryptedVideo))).toBe(bytesToHex(sha256(originalVideo)));
    });

    it('rejects tampered raw binary payload with SHA-256 hash mismatch', async () => {
      const payload = new Uint8Array(1000);
      payload.fill(42);
      const honestHash = bytesToHex(sha256(payload));

      const createRes = await cloudClient.createAttachment({
        attachmentId: 'att_tamper_test',
        spaceId: 'spc_test_tamper',
        ciphertextHash: honestHash,
        ciphertextSize: payload.length,
        mimeType: 'video/mp4',
      });

      const objectId = createRes.attachment.objectId;

      // Tamper 1 byte
      const tamperedPayload = new Uint8Array(payload);
      tamperedPayload[0] = 99;

      await expect(
        cloudClient.uploadAttachment(objectId, tamperedPayload)
      ).rejects.toThrow();
    });

    it('supports backward-compatible JSON base64 upload and download fallback', async () => {
      const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const hash = bytesToHex(sha256(payload));

      const createRes = await cloudClient.createAttachment({
        attachmentId: 'att_json_fallback_test',
        spaceId: 'spc_test_json_fallback',
        ciphertextHash: hash,
        ciphertextSize: payload.length,
        mimeType: 'video/mp4',
      });

      const objectId = createRes.attachment.objectId;

      // POST to standard base64 JSON endpoint directly
      const url = `${baseUrl}/v1/cloud/attachments/upload`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testSessionToken}`,
        },
        body: JSON.stringify({
          objectId,
          ciphertextBase64: bytesToBase64(payload),
        }),
      });
      expect(res.ok).toBe(true);

      // Download via standard JSON endpoint
      const dlRes = await fetch(`${baseUrl}/v1/cloud/attachments/download/${objectId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testSessionToken}`,
        },
      });
      expect(dlRes.ok).toBe(true);
      const body = await dlRes.json();
      expect(body.ciphertextBase64).toBe(bytesToBase64(payload));
    });
  });
});
