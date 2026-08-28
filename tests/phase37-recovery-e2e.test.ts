/**
 * Phase 37 Account Recovery E2E Regression Tests.
 *
 * Validates the complete account recovery lifecycle: registration, vault creation,
 * Argon2id KEK derivation, encrypted vault retrieval, Space Master Key restoration,
 * Ed25519 identity preservation, and cloud session credential persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountManager } from '../src/account/accountManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 37 — Account Recovery E2E', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let storageAdapter: MemoryStorageAdapter;

  // Track cloud server state to simulate round-trip
  let serverAccounts: Map<string, any>;
  let serverVaults: Map<string, any>;
  let serverSessions: Map<string, any>;

  let mockCloudClient: any;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    storageAdapter = new MemoryStorageAdapter();
    store = new EncryptedSpaceStore(storageAdapter);
    idMgr = new SpaceIdentityManager();

    serverAccounts = new Map();
    serverVaults = new Map();
    serverSessions = new Map();

    mockCloudClient = {
      registerAccount: vi.fn(async (params: any) => {
        const accountId = `acc_${params.username}`;
        const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const account = { accountId, username: params.username };
        const device = { deviceId: params.deviceId, deviceName: params.deviceName };
        const session = { sessionToken, expiresAt: Date.now() + 86400000 };
        serverAccounts.set(params.username, account);
        serverSessions.set(params.username, { account, device, session });
        return { account, device, session };
      }),

      setRecoveryVault: vi.fn(async (encryptedVaultBlob: string, kdfParams: any) => {
        const lastUsername = Array.from(serverAccounts.keys()).pop()!;
        serverVaults.set(lastUsername, { encryptedVaultBlob, kdfParams });
        return { success: true };
      }),

      restoreAccount: vi.fn(async (params: any) => {
        const vaultData = serverVaults.get(params.username);
        if (!vaultData) {
          throw new Error('Account not found');
        }
        const accountData = serverAccounts.get(params.username);
        const sessionToken = `sess_restored_${Date.now()}`;
        return {
          account: accountData || { accountId: `acc_${params.username}`, username: params.username },
          device: { deviceId: params.deviceId, deviceName: params.deviceName },
          session: { sessionToken, expiresAt: Date.now() + 86400000 },
          recovery: {
            encryptedVaultBlob: vaultData.encryptedVaultBlob,
            kdfParams: vaultData.kdfParams,
          },
        };
      }),
    };
  });

  it('registers an account, creates recovery vault, and restores identity on a clean device', async () => {
    // 1. Register original account
    const originalMgr = new AccountManager(mockCloudClient, vault, idMgr, store, storageAdapter);
    const registration = await originalMgr.registerAccount({
      username: 'alice',
      password: 'StrongPassword123!',
      spaceName: 'Alice Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const originalSession = registration.session;
    const originalIdentityDoc = registration.identityDoc;
    const originalSpaceId = originalSession.spaceId;
    const originalMasterKey = bytesToBase64(originalSession.getMasterKey());
    const originalIdentityId = originalIdentityDoc.identityId;

    // Verify cloud session was stored
    const cloudSession = store.get<any>(originalSession, 'veil:cloud:session');
    expect(cloudSession).toBeTruthy();
    expect(cloudSession.username).toBe('alice');
    expect(cloudSession.sessionToken).toBeTruthy();

    // Verify vault was uploaded to server
    expect(mockCloudClient.setRecoveryVault).toHaveBeenCalled();
    expect(serverVaults.has('alice')).toBe(true);

    // 2. Simulate clean device — new vault and store
    const cleanVault = new SpaceVaultManager();
    const cleanStorageAdapter = new MemoryStorageAdapter();
    const cleanStore = new EncryptedSpaceStore(cleanStorageAdapter);
    const cleanIdMgr = new SpaceIdentityManager();

    const restoredMgr = new AccountManager(mockCloudClient, cleanVault, cleanIdMgr, cleanStore, cleanStorageAdapter);

    // 3. Restore account
    const restoration = await restoredMgr.restoreAccount({
      username: 'alice',
      password: 'StrongPassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const restoredSession = restoration.session;
    const restoredIdentityDoc = restoration.identityDoc;

    // 4. Verify EXACT identity preservation
    expect(restoredSession.spaceId).toBe(originalSpaceId);
    expect(bytesToBase64(restoredSession.getMasterKey())).toBe(originalMasterKey);
    expect(restoredIdentityDoc.identityId).toBe(originalIdentityId);
    expect(restoredIdentityDoc.signingPublicKey).toBe(originalIdentityDoc.signingPublicKey);
    expect(restoredIdentityDoc.keyAgreementPublicKey).toBe(originalIdentityDoc.keyAgreementPublicKey);
    expect(restoredIdentityDoc.fingerprint).toBe(originalIdentityDoc.fingerprint);

    // 5. Verify cloud session was stored on restored device
    const restoredCloudSession = cleanStore.get<any>(restoredSession, 'veil:cloud:session');
    expect(restoredCloudSession).toBeTruthy();
    expect(restoredCloudSession.username).toBe('alice');
    expect(restoredCloudSession.sessionToken).toBeTruthy();

    // 6. Verify identity is loadable from restored store
    const restoredIdentity = cleanIdMgr.loadIdentity(restoredSession, cleanStore);
    expect(restoredIdentity).toBeTruthy();
    expect(restoredIdentity!.document.identityId).toBe(originalIdentityId);
  });

  it('fails restoration with wrong password', async () => {
    const mgr = new AccountManager(mockCloudClient, vault, idMgr, store, storageAdapter);
    await mgr.registerAccount({
      username: 'bob',
      password: 'CorrectPassword!',
      spaceName: 'Bob Space',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    const cleanVault = new SpaceVaultManager();
    const cleanStorageAdapter = new MemoryStorageAdapter();
    const cleanStore = new EncryptedSpaceStore(cleanStorageAdapter);
    const cleanIdMgr = new SpaceIdentityManager();
    const cleanMgr = new AccountManager(mockCloudClient, cleanVault, cleanIdMgr, cleanStore, cleanStorageAdapter);

    await expect(
      cleanMgr.restoreAccount({ username: 'bob', password: 'WrongPassword!', customKdfParams: FAST_TEST_KDF_PARAMS })
    ).rejects.toThrow(/decrypt|invalid password|corrupted/i);
  });

  it('fails restoration when no vault exists', async () => {
    const cleanVault = new SpaceVaultManager();
    const cleanStorageAdapter = new MemoryStorageAdapter();
    const cleanStore = new EncryptedSpaceStore(cleanStorageAdapter);
    const cleanIdMgr = new SpaceIdentityManager();
    const cleanMgr = new AccountManager(mockCloudClient, cleanVault, cleanIdMgr, cleanStore, cleanStorageAdapter);

    await expect(
      cleanMgr.restoreAccount({ username: 'nonexistent', password: 'test', customKdfParams: FAST_TEST_KDF_PARAMS })
    ).rejects.toThrow();
  });
});
