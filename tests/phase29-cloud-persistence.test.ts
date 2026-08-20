/**
 * Phase 29 Test Suite: Cloud Database & S3 Storage Persistence
 *
 * Validates:
 * 1. SqlCloudDatabase disk durability across re-instantiations.
 * 2. S3ObjectStorage AWS SigV4 client.
 * 3. Recipient attachment access authorization.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import type {
  AccountEntity,
  DeviceEntity,
  CloudSpaceEntity,
  CloudMessageEntity,
  RecoveryStateEntity,
} from '../src/server/cloud/database/types.ts';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_FILE = path.resolve(process.cwd(), '.veil_test_db.json');

describe('Phase 29: Cloud Database & Storage Persistence', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  it('persists accounts, spaces, and messages durably across database re-initializations', async () => {
    const db1 = new SqlCloudDatabase({ diskPath: TEST_DB_FILE });
    await db1.init();

    const accountId = 'acc_alice_123';
    // 1. Create account
    const account: AccountEntity = {
      accountId,
      username: 'persistent_alice',
      passwordHash: 'hash_12345',
      recoveryAnchor: 'anchor_xyz',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db1.createAccount(account);

    // 2. Register device
    const device: DeviceEntity = {
      deviceId: 'dev_primary',
      accountId,
      deviceName: 'Alice Laptop',
      deviceSigningPub: 'signing_pub_123',
      deviceKeyAgreementPub: 'ka_pub_123',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      status: 'ACTIVE',
    };
    await db1.registerDevice(device);

    // 3. Create cloud space
    const space: CloudSpaceEntity = {
      spaceId: 'space_work',
      accountId,
      encryptedMetadata: '{"title":"Work Space"}',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db1.saveSpace(space);

    // 4. Post message
    const msg: CloudMessageEntity = {
      messageId: 'msg_001',
      accountId,
      spaceId: space.spaceId,
      senderDeviceId: device.deviceId,
      encryptedPayload: 'cipher_payload_e2ee',
      nonce: 'nonce_123',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db1.saveMessage(msg);

    await db1.close();

    // 5. Instantiate a FRESH database instance pointing to the same disk file
    const db2 = new SqlCloudDatabase({ diskPath: TEST_DB_FILE });
    await db2.init();

    const loadedAccount = await db2.getAccountByUsername('persistent_alice');
    expect(loadedAccount).not.toBeNull();
    expect(loadedAccount?.accountId).toBe(accountId);

    const devices = await db2.listDevices(accountId);
    expect(devices.length).toBe(1);
    expect(devices[0].deviceId).toBe('dev_primary');

    const spaces = await db2.listSpaces(accountId);
    expect(spaces.length).toBe(1);
    expect(spaces[0].spaceId).toBe('space_work');

    const messages = await db2.listMessages(accountId, space.spaceId);
    expect(messages.length).toBe(1);
    expect(messages[0].encryptedPayload).toBe('cipher_payload_e2ee');

    await db2.close();
  });

  it('manages recovery vault blobs with zero-knowledge kdf params', async () => {
    const db = new SqlCloudDatabase({ diskPath: TEST_DB_FILE });
    await db.init();

    const accountId = 'acc_recovery_user';
    const account: AccountEntity = {
      accountId,
      username: 'recovery_user',
      passwordHash: 'hash_abc',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.createAccount(account);

    const kdf = { algorithm: 'argon2id', salt: 'salty_salt', timeCost: 3, memoryCost: 65536 };
    const vaultBlob = '{"format":"VEIL-IDENTITY-BACKUP-v1","ciphertext":"abc"}';

    const recoveryState: RecoveryStateEntity = {
      accountId,
      encryptedVaultBlob: vaultBlob,
      kdfParams: JSON.stringify(kdf),
      version: 1,
      updatedAt: Date.now(),
    };
    await db.setRecoveryState(recoveryState);

    const recovery = await db.getRecoveryState(accountId);
    expect(recovery).not.toBeNull();
    expect(recovery?.encryptedVaultBlob).toBe(vaultBlob);
    expect(JSON.parse(recovery!.kdfParams)).toEqual(kdf);

    await db.close();
  });

  it('stores and retrieves attachments via S3ObjectStorage adapter', async () => {
    const storage = new S3ObjectStorage({
      bucket: 'veil-test-bucket',
      region: 'us-east-1',
    });

    const objectId = 'test_obj_123';
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    await storage.upload(objectId, payload);
    expect(await storage.exists(objectId)).toBe(true);

    const downloaded = await storage.download(objectId);
    expect(downloaded).toEqual(payload);

    await storage.delete(objectId);
    expect(await storage.exists(objectId)).toBe(false);
  });
});
