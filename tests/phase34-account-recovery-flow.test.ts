/**
 * VEIL Phase 34: Zero-Knowledge Account Recovery End-to-End Regression Tests
 *
 * Verifies:
 * 1. Account registration creates and pushes zero-knowledge encrypted recovery vault.
 * 2. Fresh device / reinstalled app restores exact identical Space Master Key and Ed25519 identityId.
 * 3. Invalid credentials correctly reject without corruption.
 */

import { describe, it, expect } from 'vitest';
import { AccountManager } from '../src/account/accountManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { CloudHandler } from '../src/server/cloud/cloudHandler.ts';
import http from 'http';

describe('Phase 34: Zero-Knowledge Account Recovery Flow', () => {
  it('creates recovery vault on registration and restores exact identity on clean device', async () => {
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

    const fastKdf = { timeCost: 1, memoryCost: 1024, parallelism: 1 };

    try {
      // 1. Device A: Register account
      const clientA = new CloudClient(`http://127.0.0.1:${port}`);
      const vaultA = new SpaceVaultManager();
      const storageA = new MemoryStorageAdapter();
      const storeA = new EncryptedSpaceStore(storageA);
      const idMgrA = new SpaceIdentityManager();
      const accountMgrA = new AccountManager(clientA, vaultA, idMgrA, storeA, storageA);

      const registered = await accountMgrA.registerAccount({
        username: 'charlie_recovery_test',
        password: 'SuperSecretPassphrase123!',
        spaceName: 'Charlie Main',
        kdfParams: fastKdf,
      });

      const originalSpaceId = registered.session.spaceId;
      const originalIdentityId = registered.identityDoc.identityId;
      const originalSigningPub = registered.identityDoc.signingPublicKey;
      const originalMasterKey = registered.session.getMasterKey();

      expect(originalIdentityId).toBeTruthy();

      // 2. Device B (Clean Device): Restore account from scratch
      const clientB = new CloudClient(`http://127.0.0.1:${port}`);
      const vaultB = new SpaceVaultManager();
      const storageB = new MemoryStorageAdapter();
      const storeB = new EncryptedSpaceStore(storageB);
      const idMgrB = new SpaceIdentityManager();
      const accountMgrB = new AccountManager(clientB, vaultB, idMgrB, storeB, storageB);

      const restored = await accountMgrB.restoreAccount({
        username: 'charlie_recovery_test',
        password: 'SuperSecretPassphrase123!',
        customKdfParams: fastKdf,
      });

      // Verify identical cryptographic properties
      expect(restored.session.spaceId).toBe(originalSpaceId);
      expect(restored.identityDoc.identityId).toBe(originalIdentityId);
      expect(restored.identityDoc.signingPublicKey).toBe(originalSigningPub);
      expect(restored.session.getMasterKey()).toEqual(originalMasterKey);

      // Verify local storage adapter has the restored Space envelope
      const envelopes = vaultB.listEnvelopes();
      expect(envelopes.length).toBe(1);
      expect(envelopes[0].spaceId).toBe(originalSpaceId);
    } finally {
      server.close();
      await db.close();
    }
  });

  it('rejects recovery attempt with invalid password', async () => {
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

    const fastKdf = { timeCost: 1, memoryCost: 1024, parallelism: 1 };

    try {
      const clientA = new CloudClient(`http://127.0.0.1:${port}`);
      const vaultA = new SpaceVaultManager();
      const storageA = new MemoryStorageAdapter();
      const storeA = new EncryptedSpaceStore(storageA);
      const idMgrA = new SpaceIdentityManager();
      const accountMgrA = new AccountManager(clientA, vaultA, idMgrA, storeA, storageA);

      await accountMgrA.registerAccount({
        username: 'david_wrong_pass',
        password: 'CorrectPassphrase123!',
        spaceName: 'David Space',
        kdfParams: fastKdf,
      });

      const clientB = new CloudClient(`http://127.0.0.1:${port}`);
      const vaultB = new SpaceVaultManager();
      const storageB = new MemoryStorageAdapter();
      const storeB = new EncryptedSpaceStore(storageB);
      const idMgrB = new SpaceIdentityManager();
      const accountMgrB = new AccountManager(clientB, vaultB, idMgrB, storeB, storageB);

      await expect(
        accountMgrB.restoreAccount({
          username: 'david_wrong_pass',
          password: 'WRONG_PASSPHRASE!',
          customKdfParams: fastKdf,
        })
      ).rejects.toThrow();
    } finally {
      server.close();
      await db.close();
    }
  });
});
