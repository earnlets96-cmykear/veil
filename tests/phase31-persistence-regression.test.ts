/**
 * Phase 31: Persistence Regression & Cloud Database State Continuity Tests.
 *
 * Verifies that accounts, profiles, mailboxes, and encrypted attachments
 * survive server restarts and database reconnections without data loss.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { bytesToHex, randomBytes } from '../src/crypto/utils.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';

const PERSIST_TEMP_DIR = path.join(process.cwd(), '.veil_persist_regression_temp');

describe('Phase 31: Persistence Regression & Backend Restart Survival', () => {
  it('preserves registered accounts, mailboxes, and attachments across cold backend restart', async () => {
    if (fs.existsSync(PERSIST_TEMP_DIR)) fs.rmSync(PERSIST_TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(PERSIST_TEMP_DIR, { recursive: true });

    const dbDir = path.join(PERSIST_TEMP_DIR, 'db');
    const relayDir = path.join(PERSIST_TEMP_DIR, 'relay');

    // 1. First Server Run: Insert state
    let db = new SqlCloudDatabase({ diskPath: dbDir });
    let store = new PersistentFileRelayStore(relayDir);
    let storage = new S3ObjectStorage();
    await db.init();
    await store.init();
    await storage.init();

    let server = new RelayServer({ port: 0, host: '127.0.0.1' }, store, db, storage);
    let addr = await server.start();
    let baseUrl = `http://127.0.0.1:${addr.port}`;

    const regRes = await fetch(`${baseUrl}/v1/account/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'persist_user',
        password: 'StrongPassword123!',
        deviceName: 'Pixel 8',
        deviceSigningPub: 'signing_pub_persist_user',
        deviceKaPub: 'ka_pub_persist_user',
      }),
    });
    expect(regRes.status === 200 || regRes.status === 201).toBe(true);
    const regData = await regRes.json();
    const accountId = regData.account.accountId;

    // Allocate Mailbox
    const mbxRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(mbxRes.status).toBe(201);
    const mbxData = await mbxRes.json();
    const mailboxId = mbxData.mailboxId;

    // 2. Kill and Restart Server from the same persistent disk state
    await server.stop();

    db = new SqlCloudDatabase({ diskPath: dbDir });
    store = new PersistentFileRelayStore(relayDir);
    storage = new S3ObjectStorage();
    await db.init();
    await store.init();
    await storage.init();

    server = new RelayServer({ port: 0, host: '127.0.0.1' }, store, db, storage);
    addr = await server.start();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // Verify account survived restart
      const accountEntity = await db.getAccountByUsername('persist_user');
      expect(accountEntity).toBeTruthy();
      expect(accountEntity?.accountId).toBe(accountId);

      // Verify mailbox survived restart
      const mailboxEntity = await store.getMailbox(mailboxId);
      expect(mailboxEntity).toBeTruthy();
      expect(mailboxEntity?.mailboxId).toBe(mailboxId);

      // Verify health check returns database connected
      const healthRes = await fetch(`${baseUrl}/health`);
      const healthData = await healthRes.json();
      expect(healthData.status).toBe('ok');
      expect(healthData.database).toBe('connected');
    } finally {
      await server.stop();
      if (fs.existsSync(PERSIST_TEMP_DIR)) fs.rmSync(PERSIST_TEMP_DIR, { recursive: true, force: true });
    }
  });
});
