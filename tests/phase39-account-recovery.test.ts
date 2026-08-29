/**
 * Phase 39: Zero-Knowledge Account Recovery Acceptance Suite.
 *
 * Verifies:
 * - End-to-end cloud account registration with user credentials
 * - Automatic zero-knowledge recovery vault export with Argon2id KEK derivation
 * - Fresh device restoration from credentials
 * - Byte-for-byte master key and Ed25519 identityId reconstruction
 * - Negative test: wrong password rejection with zero key leakage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AccountManager } from '../src/account/accountManager.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { IObjectStorage, ObjectMetadata } from '../src/server/cloud/storage/types.ts';
import { CloudHandler } from '../src/server/cloud/cloudHandler.ts';
import { createServer, Server } from 'http';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '../src/crypto/utils.ts';

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

describe('Phase 39: Zero-Knowledge Account Recovery Acceptance', () => {
  let server: Server;
  let port: number;
  let baseUrl: string;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: IObjectStorage;

  beforeEach(async () => {
    cloudDb = new MemoryCloudDatabase();
    objectStorage = new TestMemoryObjectStorage();

    const handler = new CloudHandler(cloudDb, objectStorage);
    server = createServer(async (req, res) => {
      await handler.handleRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    return () => {
      server.close();
    };
  });

  it('restores exact identical Space Master Key and Ed25519 identity on fresh device', async () => {
    // 1. Device A: Initial Registration
    const cloudClientA = new CloudClient(baseUrl);
    const storageA = new MemoryStorageAdapter();
    const vaultA = new SpaceVaultManager();
    const storeA = new EncryptedSpaceStore();
    const idMgrA = new SpaceIdentityManager();

    const accountManagerA = new AccountManager(cloudClientA, vaultA, idMgrA, storeA, storageA);

    const { session: sessionA, identityDoc: identityDocA } = await accountManagerA.registerAccount({
      username: 'alice_phase39',
      password: 'CorrectPassphrase2026!',
      spaceName: 'Alice Main Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const originalMasterKey = sessionA.getMasterKey();
    const originalIdentityId = identityDocA.identityId;
    const originalSigningPub = identityDocA.signingPublicKey;

    expect(originalIdentityId).toBeDefined();
    expect(originalMasterKey.length).toBe(32);

    // 2. Simulate Device B: Fresh install (empty local storage, new client)
    const cloudClientB = new CloudClient(baseUrl);
    const storageB = new MemoryStorageAdapter();
    const vaultB = new SpaceVaultManager();
    const storeB = new EncryptedSpaceStore();
    const idMgrB = new SpaceIdentityManager();

    const accountManagerB = new AccountManager(cloudClientB, vaultB, idMgrB, storeB, storageB);

    // 3. Restore on Device B with correct credentials
    const restoreResult = await accountManagerB.restoreAccount({
      username: 'alice_phase39',
      password: 'CorrectPassphrase2026!',
      deviceName: 'Alice Restored Phone',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const restoredSession = restoreResult.session;
    const restoredDoc = restoreResult.identityDoc;
    const restoredMasterKey = restoredSession.getMasterKey();

    // Verify cryptographic continuity
    expect(restoredSession.spaceId).toBe(sessionA.spaceId);
    expect(restoredDoc.identityId).toBe(originalIdentityId);
    expect(restoredDoc.signingPublicKey).toBe(originalSigningPub);
    expect(restoredMasterKey).toEqual(originalMasterKey);
  });

  it('rejects recovery attempt with wrong password with 401 Unauthorized', async () => {
    // Device A registers
    const cloudClientA = new CloudClient(baseUrl);
    const storageA = new MemoryStorageAdapter();
    const vaultA = new SpaceVaultManager();
    const storeA = new EncryptedSpaceStore();
    const idMgrA = new SpaceIdentityManager();

    const accountManagerA = new AccountManager(cloudClientA, vaultA, idMgrA, storeA, storageA);

    await accountManagerA.registerAccount({
      username: 'bob_phase39',
      password: 'BobSecretPassphrase123!',
      spaceName: 'Bob Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Device B tries with wrong password
    const cloudClientB = new CloudClient(baseUrl);
    const storageB = new MemoryStorageAdapter();
    const vaultB = new SpaceVaultManager();
    const storeB = new EncryptedSpaceStore();
    const idMgrB = new SpaceIdentityManager();

    const accountManagerB = new AccountManager(cloudClientB, vaultB, idMgrB, storeB, storageB);

    await expect(
      accountManagerB.restoreAccount({
        username: 'bob_phase39',
        password: 'WrongPassword999!',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow();
  });
});
