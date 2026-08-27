/**
 * Phase 31: Account Recovery & Deterministic Identity Consistency Tests.
 *
 * Verifies byte-for-byte identity equality upon recovery and confirms
 * that restoring an account never creates secondary conflicting identities.
 */

import { describe, it, expect } from 'vitest';
import { AccountManager } from '../src/account/accountManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

// Mock CloudClient simulating zero-knowledge cloud persistence
class MockZeroKnowledgeCloudClient {
  private recoveryVaultBlob: string | null = null;
  private recoveryKdfParams: any = null;
  public registeredAccounts = new Map<string, any>();

  async registerAccount(params: any) {
    const account = {
      accountId: `acc_${params.username.toLowerCase()}`,
      username: params.username.toLowerCase(),
      createdAt: Date.now(),
    };
    const device = {
      deviceId: params.deviceId,
      deviceName: params.deviceName,
    };
    const session = {
      sessionId: 'sess_123',
      sessionToken: 'token_abc',
      expiresAt: Date.now() + 86400000,
    };
    this.registeredAccounts.set(params.username.toLowerCase(), { account, device, session });
    return { account, device, session };
  }

  async setRecoveryVault(encryptedVaultBlob: string, kdfParams: any) {
    this.recoveryVaultBlob = encryptedVaultBlob;
    this.recoveryKdfParams = kdfParams;
    return { success: true };
  }

  async restoreAccount(params: any) {
    const record = this.registeredAccounts.get(params.username.toLowerCase());
    if (!record) throw new Error('Account not found');
    return {
      account: record.account,
      device: { deviceId: params.deviceId, deviceName: params.deviceName },
      session: { sessionId: 'sess_restored', sessionToken: 'token_restored', expiresAt: Date.now() + 86400000 },
      recovery: {
        encryptedVaultBlob: this.recoveryVaultBlob,
        kdfParams: this.recoveryKdfParams,
      },
    };
  }
}

describe('Phase 31: Account Recovery & Identity Continuity', () => {
  it('recovers exact original identityId byte-for-byte upon restoration on a clean device', async () => {
    const cloudClient = new MockZeroKnowledgeCloudClient();

    // 1. Primary Device: Register account & generate identity
    const vault1 = new SpaceVaultManager();
    const idMgr1 = new SpaceIdentityManager();
    const memory1 = new MemoryStorageAdapter();
    const store1 = new EncryptedSpaceStore(memory1);
    const accountMgr1 = new AccountManager(cloudClient as any, vault1, idMgr1, store1, memory1);

    const regResult = await accountMgr1.registerAccount({
      username: 'alice',
      password: 'StrongSecretPassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const originalIdentityId = regResult.identityDoc.identityId;
    const originalSigningPub = regResult.identityDoc.signingPublicKey;
    const originalKaPub = regResult.identityDoc.keyAgreementPublicKey;

    // 2. Clean Second Device: Restore account from zero-knowledge backup
    const vault2 = new SpaceVaultManager();
    const idMgr2 = new SpaceIdentityManager();
    const memory2 = new MemoryStorageAdapter();
    const store2 = new EncryptedSpaceStore(memory2);
    const accountMgr2 = new AccountManager(cloudClient as any, vault2, idMgr2, store2, memory2);

    const restoreResult = await accountMgr2.restoreAccount({
      username: 'alice',
      password: 'StrongSecretPassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    // INVARIANT: Byte-for-byte exact identifier and public key equality
    expect(restoreResult.identityDoc.identityId).toBe(originalIdentityId);
    expect(restoreResult.identityDoc.signingPublicKey).toBe(originalSigningPub);
    expect(restoreResult.identityDoc.keyAgreementPublicKey).toBe(originalKaPub);
    expect(restoreResult.account.accountId).toBe(regResult.account.accountId);

    // 3. Repeated restoration reproduces the identical identity without secondary identity generation
    const restoreResult2 = await accountMgr2.restoreAccount({
      username: 'alice',
      password: 'StrongSecretPassword123!',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(restoreResult2.identityDoc.identityId).toBe(originalIdentityId);
  });
});
