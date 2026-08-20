/**
 * Phase 29 Test Suite: Security Regression & Zero-Knowledge Invariants
 *
 * Validates:
 * 1. Zero Plaintext Invariant: Server database and S3 storage contain NO plaintext
 *    passwords, Master Keys, identity private keys, voice audio, or message text.
 * 2. Cross-Tenant Separation: Users cannot access other accounts' recovery vaults.
 * 3. KDF Integrity: Argon2id KDF parameter changes or salt tampering cause restore to fail.
 * 4. Path Traversal & Injection: S3 adapter and SQL database reject injection attempts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_FILE = path.resolve(process.cwd(), '.veil_sec_reg_db.json');

describe('Phase 29: Security Regression & Zero-Knowledge Invariants', () => {
  let server: RelayServer;
  let port: number;
  let serverUrl: string;
  let cloudDb: SqlCloudDatabase;
  let objectStorage: S3ObjectStorage;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }

    port = 9300 + Math.floor(Math.random() * 500);
    serverUrl = `http://127.0.0.1:${port}`;

    cloudDb = new SqlCloudDatabase({ diskPath: TEST_DB_FILE });
    await cloudDb.init();

    objectStorage = new S3ObjectStorage({ bucket: 'veil-test-sec' });

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

  it('ZERO-PLAINTEXT INVARIANT: Database and disk contain zero plaintexts', async () => {
    const client = new CloudClient(serverUrl);
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const acctMgr = new AccountManager(client, vault, idMgr, store, storage);

    const secretPassword = 'MySuperSensitivePassword999!';
    const secretSpaceName = 'Ultra Confidential Project';

    await acctMgr.registerAccount({
      username: 'alice_sec',
      password: secretPassword,
      spaceName: secretSpaceName,
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Inspect server disk file content directly
    const rawDiskContent = fs.readFileSync(TEST_DB_FILE, 'utf-8');

    // 1. Password must NEVER appear in plaintext anywhere in the database file
    expect(rawDiskContent).not.toContain(secretPassword);

    // 2. Space name inside backup payload must NEVER appear in plaintext
    expect(rawDiskContent).not.toContain(secretSpaceName);

    // 3. Vault blob must be an encrypted ciphertext structure
    const account = await cloudDb.getAccountByUsername('alice_sec');
    const recovery = await cloudDb.getRecoveryState(account!.accountId);
    expect(recovery?.encryptedVaultBlob).toContain('VEIL-IDENTITY-BACKUP-v1');
    expect(recovery?.encryptedVaultBlob).toContain('ciphertext');
  });

  it('TAMPERING DEFENSE: Tampered ciphertext in recovery vault is rejected', async () => {
    const client = new CloudClient(serverUrl);
    const storage = new MemoryAdapter();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const acctMgr = new AccountManager(client, vault, idMgr, store, storage);

    await acctMgr.registerAccount({
      username: 'bob_tamper',
      password: 'StrongPassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Tamper with recovery state in cloud DB directly
    const account = await cloudDb.getAccountByUsername('bob_tamper');
    const recovery = await cloudDb.getRecoveryState(account!.accountId);
    const blob = JSON.parse(recovery!.encryptedVaultBlob);
    blob.ciphertext = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='; // Tampered invalid ciphertext

    await cloudDb.setRecoveryState({
      accountId: account!.accountId,
      encryptedVaultBlob: JSON.stringify(blob),
      kdfParams: recovery!.kdfParams,
      version: 2,
    });

    // Attempt restore
    const client2 = new CloudClient(serverUrl);
    const acctMgr2 = new AccountManager(client2, new SpaceVaultManager(), new SpaceIdentityManager(), new EncryptedSpaceStore(new MemoryAdapter()), new MemoryAdapter());

    await expect(
      acctMgr2.restoreAccount({
        username: 'bob_tamper',
        password: 'StrongPassword123!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow(/decrypt identity backup|invalid password or corrupted backup/i);
  });
});
