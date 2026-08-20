/**
 * Phase 30: PostgreSQL Persistence & Migration Test Suite
 *
 * Verifies SQL database operations, parameterized query execution,
 * foreign key integrity, schema migrations, and durable entity persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { MigrationRunner } from '../src/server/cloud/database/migrations/migrationRunner.ts';
import type {
  AccountEntity,
  DeviceEntity,
  CloudSpaceEntity,
  CloudMessageEntity,
} from '../src/server/cloud/database/types.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 30: PostgreSQL Database Persistence & Migrations', () => {
  const testDbDir = path.join(process.cwd(), '.veil_test_pg_suite');
  let db: SqlCloudDatabase;

  beforeEach(async () => {
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
    db = new SqlCloudDatabase({ diskPath: testDbDir });
    await db.init();
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  it('runs all deterministic migrations in order', async () => {
    const runner = new MigrationRunner();
    const migrations = runner.getMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(2);
    expect(migrations[0].id).toBe('001_initial_cloud_schema');
    expect(migrations[1].id).toBe('002_relay_and_directory_persistence');

    const applied = db.getAppliedMigrations();
    expect(applied).toContain('001_initial_cloud_schema');
    expect(applied).toContain('002_relay_and_directory_persistence');
  });

  it('persists accounts and rejects duplicate username registration', async () => {
    const acc: AccountEntity = {
      accountId: 'acc_alice_001',
      username: 'alice',
      passwordHash: 'argon2id_hash_alice',
      authSalt: 'salt_alice',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.createAccount(acc);

    const fetched = await db.getAccountByUsername('alice');
    expect(fetched).not.toBeNull();
    expect(fetched?.accountId).toBe('acc_alice_001');

    // Case-insensitive duplicate test
    await expect(
      db.createAccount({
        accountId: 'acc_alice_002',
        username: 'ALICE',
        passwordHash: 'argon2id_hash_alice2',
        authSalt: 'salt_alice2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    ).rejects.toThrow(/already registered/i);
  });

  it('enforces foreign key relationships for devices, spaces, and messages', async () => {
    // Attempting to create device without account should fail
    const orphanDevice: DeviceEntity = {
      deviceId: 'dev_orphan',
      accountId: 'non_existent_acc',
      deviceName: 'Phantom Device',
      deviceSigningPub: 'pub_key',
      deviceKeyAgreementPub: 'dh_key',
      status: 'ACTIVE',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    await expect(db.registerDevice(orphanDevice)).rejects.toThrow(/Foreign Key Violation/i);

    // Create valid account first
    await db.createAccount({
      accountId: 'acc_bob_001',
      username: 'bob',
      passwordHash: 'hash_bob',
      authSalt: 'salt_bob',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Valid device registration
    const validDevice: DeviceEntity = {
      deviceId: 'dev_bob_phone',
      accountId: 'acc_bob_001',
      deviceName: "Bob's Pixel",
      deviceSigningPub: 'pub_key_bob',
      deviceKeyAgreementPub: 'dh_key_bob',
      status: 'ACTIVE',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    await db.registerDevice(validDevice);

    const devices = await db.listDevices('acc_bob_001');
    expect(devices.length).toBe(1);
    expect(devices[0].deviceName).toBe("Bob's Pixel");
  });

  it('preserves messages and sync state correctly', async () => {
    await db.createAccount({
      accountId: 'acc_charlie',
      username: 'charlie',
      passwordHash: 'hash_c',
      authSalt: 'salt_c',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const space: CloudSpaceEntity = {
      spaceId: 'space_personal',
      accountId: 'acc_charlie',
      encryptedMetadata: 'encrypted_header_bytes',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveSpace(space);

    const msg: CloudMessageEntity = {
      messageId: 'msg_101',
      accountId: 'acc_charlie',
      spaceId: 'space_personal',
      conversationId: 'conv_main',
      senderDeviceId: 'dev_charlie_laptop',
      encryptedPayload: 'ciphertext_base64',
      nonce: 'nonce_bytes',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveMessage(msg);

    const messages = await db.listMessages('acc_charlie', 'space_personal');
    expect(messages.length).toBe(1);
    expect(messages[0].encryptedPayload).toBe('ciphertext_base64');

    // Update sync cursor
    await db.setSyncCursor('acc_charlie', 'dev_charlie_laptop', 'space_personal', 1);
    const cursor = await db.getSyncCursor('acc_charlie', 'dev_charlie_laptop', 'space_personal');
    expect(cursor).toBe(1);
  });
});
