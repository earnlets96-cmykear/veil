/**
 * Phase 30: Attachment Access Control & Multi-Tenant Authorization Test Suite
 *
 * Verifies that attachment downloads are permitted for the uploader and legitimate conversation peers,
 * while unauthorized third parties are strictly rejected with 404/403.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { CloudHandler } from '../src/server/cloud/cloudHandler.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '../src/crypto/utils.ts';
import http from 'http';

describe('Phase 30: Multi-Tenant Attachment Access Control', () => {
  let db: SqlCloudDatabase;
  let storage: S3ObjectStorage;
  let handler: CloudHandler;
  let server: http.Server;
  let port: number;

  const hashToken = (token: string) => bytesToHex(sha256(new TextEncoder().encode(token)));

  beforeEach(async () => {
    db = new SqlCloudDatabase(':memory:');
    storage = new S3ObjectStorage();
    await db.init();
    await storage.init();

    handler = new CloudHandler(db, storage);

    // Setup mock accounts
    await db.createAccount({
      accountId: 'acc_alice',
      username: 'alice',
      authHash: 'hash_a',
      authSalt: 'salt_a',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.registerDevice({
      deviceId: 'dev_alice',
      accountId: 'acc_alice',
      deviceName: "Alice's Device",
      signingPublicKey: 'pub_a',
      keyAgreementPublicKey: 'dh_a',
      status: 'ACTIVE',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });

    await db.createAccount({
      accountId: 'acc_bob',
      username: 'bob',
      authHash: 'hash_b',
      authSalt: 'salt_b',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.registerDevice({
      deviceId: 'dev_bob',
      accountId: 'acc_bob',
      deviceName: "Bob's Device",
      signingPublicKey: 'pub_b',
      keyAgreementPublicKey: 'dh_b',
      status: 'ACTIVE',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });

    await db.createAccount({
      accountId: 'acc_eve',
      username: 'eve',
      authHash: 'hash_e',
      authSalt: 'salt_e',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.registerDevice({
      deviceId: 'dev_eve',
      accountId: 'acc_eve',
      deviceName: "Eve's Device",
      signingPublicKey: 'pub_e',
      keyAgreementPublicKey: 'dh_e',
      status: 'ACTIVE',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });

    // Create active sessions
    await db.createSession({
      sessionId: 'sess_alice',
      accountId: 'acc_alice',
      deviceId: 'dev_alice',
      sessionToken: 'tok_alice',
      tokenHash: hashToken('tok_alice'),
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    await db.createSession({
      sessionId: 'sess_bob',
      accountId: 'acc_bob',
      deviceId: 'dev_bob',
      sessionToken: 'tok_bob',
      tokenHash: hashToken('tok_bob'),
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    await db.createSession({
      sessionId: 'sess_eve',
      accountId: 'acc_eve',
      deviceId: 'dev_eve',
      sessionToken: 'tok_eve',
      tokenHash: hashToken('tok_eve'),
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    server = http.createServer(async (req, res) => {
      await handler.handleRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
    await storage.close();
  });

  it('allows uploader and intended recipient, rejects unauthorized third party', async () => {
    // 1. Alice creates attachment intended for Bob
    const createRes = await fetch(`http://127.0.0.1:${port}/v1/cloud/attachments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok_alice',
      },
      body: JSON.stringify({
        attachmentId: 'att_secret_photo',
        spaceId: 'space_alice',
        recipientAccountId: 'acc_bob',
        ciphertextHash: '0000000000000000000000000000000000000000000000000000000000000000',
        ciphertextSize: 3,
      }),
    });
    expect(createRes.status).toBe(201);
    const { attachment } = await createRes.json();
    const objectId = attachment.objectId;

    // Direct mock storage upload
    await storage.upload(objectId, new Uint8Array([1, 2, 3]));

    // 2. Alice (uploader) can download
    const aliceGet = await fetch(`http://127.0.0.1:${port}/v1/cloud/attachments/download/${objectId}`, {
      headers: { Authorization: 'Bearer tok_alice' },
    });
    expect(aliceGet.status).toBe(200);

    // 3. Bob (recipient) can download
    const bobGet = await fetch(`http://127.0.0.1:${port}/v1/cloud/attachments/download/${objectId}`, {
      headers: { Authorization: 'Bearer tok_bob' },
    });
    expect(bobGet.status).toBe(200);

    // 4. Eve (unauthorized third-party) is REJECTED with 404
    const eveGet = await fetch(`http://127.0.0.1:${port}/v1/cloud/attachments/download/${objectId}`, {
      headers: { Authorization: 'Bearer tok_eve' },
    });
    expect(eveGet.status).toBe(404);
  });
});
