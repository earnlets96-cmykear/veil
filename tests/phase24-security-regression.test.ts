import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 24: Security Regression & Zero-Plaintext Audit Tests', () => {
  it('confirms zero unencrypted master keys, passwords, or plaintexts in database adapter', async () => {
    const memoryAdapter = new MemoryStorageAdapter();
    await memoryAdapter.init();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(memoryAdapter);

    const testPassword = 'VerySecretPassword999!';
    const envRecord = vault.createSpace({ name: 'Security Audit Space', password: testPassword, kdfParams: FAST_TEST_KDF_PARAMS });
    await vault.saveEnvelopeToStorage(envRecord, memoryAdapter);

    const session = vault.unlockSpace(testPassword, envRecord.spaceId);
    await store.loadPartitionFromStorage(session);

    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(session, store);

    // Save a secret message
    const secretPlaintext = 'TOP_SECRET_UNENCRYPTED_MESSAGE_PAYLOAD_987654321';
    await store.setAsync(session, 'veil:ui:messages', {
      [doc.identityId]: [{ id: 'm1', text: secretPlaintext }],
    });

    // Inspect the raw memory storage records directly
    const rawEnvelopes = await memoryAdapter.listEnvelopes();
    for (const env of rawEnvelopes) {
      const strVal = JSON.stringify(env);
      expect(strVal).not.toContain(testPassword);
      expect(strVal).not.toContain(secretPlaintext);
    }

    const rawRecords = await memoryAdapter.listRecords(session.spaceId);
    for (const rec of rawRecords) {
      const strVal = JSON.stringify(rec);
      expect(strVal).not.toContain(testPassword);
      expect(strVal).not.toContain(secretPlaintext);
    }
  });
});
