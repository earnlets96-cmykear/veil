/**
 * Phase 30: Zero-Knowledge Account Recovery Test Suite
 *
 * Verifies that account recovery restores the exact identical identityId
 * and Space Master Key byte-for-byte on a clean device without generating a new identity.
 */

import { describe, it, expect } from 'vitest';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { SpaceVault } from '../src/spaces/vault.ts';
import { RecoveryVault } from '../src/recovery/recoveryVault.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import type { RecoveryStateEntity } from '../src/server/cloud/database/types.ts';

describe('Phase 30: Zero-Knowledge Account Recovery Invariants', () => {
  it('restores exact identical identityId and Space Master Key from seed/mnemonic', async () => {
    // 1. Initial Device Setup
    const storeDevice1 = new MemoryStorageAdapter();
    const vault1 = new SpaceVault(storeDevice1);

    // Initialize Space on Device 1
    const envelope1 = vault1.createSpace({
      name: 'Personal Space',
      password: 'alice-passphrase',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const session1 = vault1.unlockSpace('alice-passphrase', envelope1.spaceId);
    const spaceStore1 = new EncryptedSpaceStore(storeDevice1);

    const idMgr1 = new SpaceIdentityManager();
    const identityDoc1 = idMgr1.createIdentity(session1, spaceStore1);

    const originalIdentityId = identityDoc1.identityId;
    const originalSigningPub = identityDoc1.signingPublicKey;
    const originalDhPub = identityDoc1.keyAgreementPublicKey;
    const originalSpaceMasterKey = session1.getMasterKey();

    // Export BIP-39 mnemonic
    const mnemonic = RecoveryVault.exportMnemonicPhrase(session1);
    expect(mnemonic.split(' ').length).toBe(24);

    // 2. Mock Cloud Backup in Database
    const db = new SqlCloudDatabase(':memory:');
    await db.init();

    const recoveryRecord: RecoveryStateEntity = {
      accountId: 'acc_alice',
      recoveryId: 'rec_primary',
      encryptedVaultBlob: JSON.stringify({
        identityId: originalIdentityId,
        mnemonicPhrase: mnemonic,
      }),
      kdfParams: JSON.stringify({ algorithm: 'argon2id', iterations: 1 }),
      updatedAt: Date.now(),
    };
    await db.saveRecoveryState(recoveryRecord);

    // 3. Clean Device 2 Restoration Flow (simulate fresh app install)
    const fetchedRecovery = await db.getRecoveryState('acc_alice');
    expect(fetchedRecovery).not.toBeNull();

    const storeDevice2 = new MemoryStorageAdapter();
    const vault2 = new SpaceVault(storeDevice2);

    const vaultPayload = JSON.parse(fetchedRecovery!.encryptedVaultBlob);
    const recovered = RecoveryVault.recoverSpaceFromMnemonic(
      vaultPayload.mnemonicPhrase,
      'Personal Space',
      'alice-passphrase',
      vault2,
      FAST_TEST_KDF_PARAMS
    );
    const session2 = recovered.session;
    const spaceStore2 = new EncryptedSpaceStore(storeDevice2);

    const idMgr2 = new SpaceIdentityManager();
    const identityDoc2 = idMgr2.createIdentity(session2, spaceStore2);

    // 4. Assert Invariant: Identity and Keys MUST match 100% byte-for-byte
    expect(identityDoc2.identityId).toBe(originalIdentityId);
    expect(identityDoc2.signingPublicKey).toEqual(originalSigningPub);
    expect(identityDoc2.keyAgreementPublicKey).toEqual(originalDhPub);
    expect(session2.getMasterKey()).toEqual(originalSpaceMasterKey);
  });
});
