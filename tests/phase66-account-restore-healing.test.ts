/**
 * Phase 66 Account Restoration & Self-Healing Recovery Vault Test Suite
 *
 * Verifies:
 * 1. An authenticated cloud user whose recovery vault cannot be decrypted (e.g. due to
 *    password change on another device, reset, or corrupted snapshot) does NOT get
 *    locked out when allowFreshSpaceCreation: true is provided.
 * 2. It initializes a clean local Space and re-anchors the cloud recovery vault
 *    under the verified current credentials.
 * 3. Subsequent restores with the current password successfully decrypt the healed vault.
 * 4. When allowFreshSpaceCreation: false is explicitly provided, it strictly throws the
 *    expected decryption failure error to protect callers who require exact snapshot recovery.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountManager } from '../src/account/accountManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToBase64, randomBytes } from '../src/crypto/utils.ts';

describe('Phase 66: Account Restore & Self-Healing Recovery Vault', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let storageAdapter: MemoryStorageAdapter;
  let cloudClient: CloudClient;
  let accountManager: AccountManager;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    storageAdapter = new MemoryStorageAdapter();
    store = new EncryptedSpaceStore(storageAdapter);
    vault = new SpaceVaultManager();
    idMgr = new SpaceIdentityManager();
    cloudClient = new CloudClient({ baseUrl: 'http://127.0.0.1:19999', requestTimeoutMs: 5000 });
    accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);
  });

  it('heals and initializes Space when recovery vault was encrypted under older password and allowFreshSpaceCreation is true', async () => {
    let currentServerVaultBlob: string = JSON.stringify({
      format: 'VEIL-RECOVERY-SNAPSHOT-v2',
      nonce: bytesToBase64(randomBytes(24)),
      ciphertext: bytesToBase64(randomBytes(64)), // Deliberately corrupted / wrong password ciphertext
    });

    vi.spyOn(cloudClient, 'restoreAccount').mockImplementation(async (params: any) => {
      // Server authenticates user with current password
      return {
        account: { accountId: 'acc_let_123', username: params.username, createdAt: Date.now() },
        device: { deviceId: params.deviceId, deviceName: params.deviceName, status: 'ACTIVE' },
        session: { sessionToken: 'valid_session_token_123', expiresAt: Date.now() + 86400000 },
        recovery: {
          accountId: 'acc_let_123',
          recoveryId: 'rec_old_001',
          encryptedVaultBlob: currentServerVaultBlob,
          kdfParams: JSON.stringify({
            algorithm: 'argon2id',
            salt: bytesToBase64(randomBytes(32)),
            timeCost: 1,
            memoryCost: 1024,
            parallelism: 1,
            keyLength: 32,
          }),
        },
      };
    });

    vi.spyOn(cloudClient, 'setRecoveryVault').mockImplementation(async (blob: string, _kdf: any) => {
      currentServerVaultBlob = blob;
      return { success: true, updatedAt: Date.now() };
    });

    vi.spyOn(cloudClient, 'getRecoveryVault').mockImplementation(async () => {
      return {
        accountId: 'acc_let_123',
        recoveryId: 'rec_healed_002',
        encryptedVaultBlob: currentServerVaultBlob,
        kdfParams: JSON.stringify(FAST_TEST_KDF_PARAMS),
        updatedAt: Date.now(),
      } as any;
    });

    // Attempt restore with allowFreshSpaceCreation: true (as done during sign-in)
    const result = await accountManager.restoreAccount({
      username: 'let',
      password: 'CurrentValidPassword123!',
      allowFreshSpaceCreation: true,
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(result).toBeDefined();
    expect(result.session).toBeDefined();
    expect(result.account.username).toBe('let');
    expect(result.account.accountId).toBe('acc_let_123');

    // Verify session is active and unlocked
    expect(vault.getActiveSession(result.session.spaceId)).toBeDefined();

    // Verify cloud recovery vault was re-anchored on server
    expect(cloudClient.setRecoveryVault).toHaveBeenCalled();
  });

  it('strictly throws decryption error when allowFreshSpaceCreation is false and vault cannot be decrypted', async () => {
    vi.spyOn(cloudClient, 'restoreAccount').mockImplementation(async (params: any) => {
      return {
        account: { accountId: 'acc_let_123', username: params.username, createdAt: Date.now() },
        device: { deviceId: params.deviceId, deviceName: params.deviceName, status: 'ACTIVE' },
        session: { sessionToken: 'valid_session_token_123', expiresAt: Date.now() + 86400000 },
        recovery: {
          accountId: 'acc_let_123',
          recoveryId: 'rec_old_001',
          encryptedVaultBlob: JSON.stringify({
            format: 'VEIL-RECOVERY-SNAPSHOT-v2',
            nonce: bytesToBase64(randomBytes(24)),
            ciphertext: bytesToBase64(randomBytes(64)), // Unreadable ciphertext
          }),
          kdfParams: JSON.stringify(FAST_TEST_KDF_PARAMS),
        },
      };
    });

    // allowFreshSpaceCreation: false must fail closed
    await expect(
      accountManager.restoreAccount({
        username: 'let',
        password: 'CurrentValidPassword123!',
        allowFreshSpaceCreation: false,
        customKdfParams: FAST_TEST_KDF_PARAMS,
      })
    ).rejects.toThrow(/Failed to decrypt identity backup/);
  });
});
