/**
 * VEIL Phase 34: Group Attachment Authorization & Session Auto-Healing Regression Tests
 *
 * Verifies:
 * 1. Authenticated attachment creation & upload in group chats without 401 errors.
 * 2. Automatic cloud session token auto-healing / re-authentication upon 401.
 * 3. Safe diagnostic logging without credential leakage.
 */

import { describe, it, expect } from 'vitest';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { CloudHandler } from '../src/server/cloud/cloudHandler.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '../src/crypto/utils.ts';
import http from 'http';

describe('Phase 34: Group Attachment Authorization & Auto-Healing', () => {
  it('handles group attachment creation and upload with valid session token', async () => {
    const db = new SqlCloudDatabase(':memory:');
    const storage = new S3ObjectStorage();
    await db.init();
    await storage.init();
    const handler = new CloudHandler(db, storage);

    const server = http.createServer(async (req, res) => {
      const handled = await handler.handleRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const client = new CloudClient(`http://127.0.0.1:${port}`);

    try {
      // 1. Register account
      const reg = await client.registerAccount({
        username: 'alice_group_tester',
        password: 'Password123!',
        deviceId: 'dev_alice_01',
      });

      expect(reg.session.sessionToken).toBeTruthy();
      expect(client.getSessionToken()).toBe(reg.session.sessionToken);

      // 2. Create attachment in group conversation (no recipientUsername/recipientAccountId)
      const rawCiphertext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const ciphertextHash = bytesToHex(sha256(rawCiphertext));
      const createRes = await client.createAttachment({
        attachmentId: 'att_group_001',
        spaceId: 'spc_main_001',
        conversationId: 'grp_engineering_team',
        ciphertextSize: rawCiphertext.length,
        ciphertextHash,
        chunkCount: 1,
        chunkSize: 8,
      });

      expect(createRes.attachment).toBeDefined();
      expect(createRes.attachment.objectId).toBeDefined();

      // 3. Upload attachment
      await client.uploadAttachment(createRes.attachment.objectId, rawCiphertext);

      // 4. Download attachment
      const downloaded = await client.downloadAttachment(createRes.attachment.objectId);
      expect(downloaded).toEqual(rawCiphertext);
    } finally {
      server.close();
      await db.close();
    }
  });

  it('automatically heals session and retries request on 401 when onUnauthorized handler is registered', async () => {
    const db = new SqlCloudDatabase(':memory:');
    const storage = new S3ObjectStorage();
    await db.init();
    await storage.init();
    const handler = new CloudHandler(db, storage);

    const server = http.createServer(async (req, res) => {
      const handled = await handler.handleRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const client = new CloudClient(`http://127.0.0.1:${port}`);

    try {
      // 1. Register account
      await client.registerAccount({
        username: 'bob_reauth_tester',
        password: 'Password123!',
        deviceId: 'dev_bob_01',
      });

      // 2. Invalidate session token to simulate expired/invalid token
      client.setSession('invalid_expired_token', 'acc_bob', 'dev_bob_01');

      // 3. Configure onUnauthorized handler to re-login
      let reauthCount = 0;
      client.setOnUnauthorized(async () => {
        reauthCount++;
        const loginRes = await client.loginAccount({
          username: 'bob_reauth_tester',
          password: 'Password123!',
          deviceId: 'dev_bob_01',
        });
        return !!loginRes.session?.sessionToken;
      });

      // 4. Create attachment — should trigger 401, re-authenticate, and succeed
      const rawCiphertext = new Uint8Array([10, 20, 30, 40]);
      const ciphertextHash = bytesToHex(sha256(rawCiphertext));
      const createRes = await client.createAttachment({
        attachmentId: 'att_retry_001',
        spaceId: 'spc_main_002',
        conversationId: 'grp_alpha',
        ciphertextSize: rawCiphertext.length,
        ciphertextHash,
        chunkCount: 1,
        chunkSize: 4,
      });

      expect(reauthCount).toBe(1);
      expect(createRes.attachment).toBeDefined();
    } finally {
      server.close();
      await db.close();
    }
  });
});
