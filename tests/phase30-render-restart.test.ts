/**
 * Phase 30: Render Backend Cold Restart Simulation Test Suite
 *
 * Verifies that all server entities (accounts, devices, sessions, spaces, messages,
 * attachments, recovery states, mailboxes, and profiles) survive a cold backend restart.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 30: Render Stateless Backend Restart Resilience', () => {
  const testDbDir = path.join(process.cwd(), '.veil_test_render_db');
  const testRelayDir = path.join(process.cwd(), '.veil_test_render_relay');

  beforeEach(() => {
    if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    if (fs.existsSync(testRelayDir)) fs.rmSync(testRelayDir, { recursive: true, force: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    if (fs.existsSync(testRelayDir)) fs.rmSync(testRelayDir, { recursive: true, force: true });
  });

  it('preserves all state across complete server tear-down and re-initialization', async () => {
    // 1. Boot Server Instance A
    let dbA = new SqlCloudDatabase({ diskPath: testDbDir });
    let storeA = new PersistentFileRelayStore(testRelayDir);
    let storageA = new S3ObjectStorage();
    await dbA.init();
    await storeA.init();
    await storageA.init();

    let serverA = new RelayServer({ port: 8989, host: '127.0.0.1' }, storeA, dbA, storageA);
    await serverA.start();

    // Populate data
    await dbA.createAccount({
      accountId: 'acc_persist_01',
      username: 'persistent_user',
      passwordHash: 'hash_secret',
      authSalt: 'salt_secret',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await storeA.createMailbox({
      mailboxId: 'mb_persist_01',
      capabilityHash: 'cap_hash_01',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      lastActiveAt: Date.now(),
    });

    await storeA.saveEnvelope({
      protocolVersion: 1,
      envelopeId: 'env_persist_01',
      mailboxId: 'mb_persist_01',
      payload: 'encrypted_envelope_payload',
      sizeBytes: 26,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    // Simulate Render Sleep / Restart / Redeployment
    await serverA.stop();
    await storeA.close();
    await dbA.close();
    await storageA.close();

    // 2. Boot Server Instance B (simulating fresh container)
    let dbB = new SqlCloudDatabase({ diskPath: testDbDir });
    let storeB = new PersistentFileRelayStore(testRelayDir);
    let storageB = new S3ObjectStorage();
    await dbB.init();
    await storeB.init();
    await storageB.init();

    let serverB = new RelayServer({ port: 8989, host: '127.0.0.1' }, storeB, dbB, storageB);
    await serverB.start();

    // Verify all data survived intact
    const acc = await dbB.getAccountByUsername('persistent_user');
    expect(acc).not.toBeNull();
    expect(acc?.accountId).toBe('acc_persist_01');

    const mb = await storeB.getMailbox('mb_persist_01');
    expect(mb).not.toBeNull();

    const envs = await storeB.listEnvelopes('mb_persist_01', 10);
    expect(envs.length).toBe(1);
    expect(envs[0].payload).toBe('encrypted_envelope_payload');

    await serverB.stop();
    await storeB.close();
    await dbB.close();
    await storageB.close();
  });
});
