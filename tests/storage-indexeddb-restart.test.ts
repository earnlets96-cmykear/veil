import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBStorageAdapter } from '../src/storage/indexedDbAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 11: Real Browser Restart & Plaintext Persistence Protection Tests', () => {
  const TEST_DB_NAME = 'veil_test_restart_db';

  beforeEach(async () => {
    // Ensure clean state before each test
    const adapter = new IndexedDBStorageAdapter(TEST_DB_NAME);
    await adapter.destroyDatabase();
  });

  afterEach(async () => {
    const adapter = new IndexedDBStorageAdapter(TEST_DB_NAME);
    await adapter.destroyDatabase();
  });

  it('REAL PERSISTENCE RESTART TEST: Persists across independent connection instances without plaintext leakage', async () => {
    // =========================================================================
    // STEP 1: Application Instance 1 (First Run)
    // =========================================================================
    const adapter1 = new IndexedDBStorageAdapter(TEST_DB_NAME);
    await adapter1.init();
    expect(adapter1.isInitialized()).toBe(true);

    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(adapter1);

    // Create Spaces
    const envMain = vault1.createSpace({
      name: 'Personal Main',
      password: 'PasswordMain123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const envWork = vault1.createSpace({
      name: 'Secret Work',
      password: 'PasswordWork456!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Save envelopes to persistent storage
    await vault1.saveEnvelopeToStorage(envMain, adapter1);
    await vault1.saveEnvelopeToStorage(envWork, adapter1);

    // Unlock Spaces in Instance 1 and write encrypted application records
    const sessionMain1 = vault1.unlockSpace('PasswordMain123!', envMain.spaceId);
    const sessionWork1 = vault1.unlockSpace('PasswordWork456!', envWork.spaceId);

    const mainProfile = { displayName: 'Alice Primary', status: 'Online' };
    const mainChat = { recipient: 'Bob', text: 'Classified message in Main Space' };

    const workProfile = { displayName: 'Alice Work Alias', role: 'Security Ops' };
    const workSecret = { project: 'Project Blackout', payload: 'Top Secret Payload' };

    await store1.setAsync(sessionMain1, 'profile', mainProfile);
    await store1.setAsync(sessionMain1, 'chat_01', mainChat);

    await store1.setAsync(sessionWork1, 'profile', workProfile);
    await store1.setAsync(sessionWork1, 'secret_doc', workSecret);

    // Explicitly lock all sessions and CLOSE connection 1
    vault1.lockAll();
    await adapter1.close();
    expect(adapter1.isInitialized()).toBe(false);

    // =========================================================================
    // STEP 2: Application Instance 2 (Simulating Fresh Browser Reload / Restart)
    // =========================================================================
    const adapter2 = new IndexedDBStorageAdapter(TEST_DB_NAME);
    await adapter2.init();
    expect(adapter2.isInitialized()).toBe(true);

    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(adapter2);

    // Discover persisted envelopes from storage adapter
    const loadedCount = await vault2.loadEnvelopesFromStorage(adapter2);
    expect(loadedCount).toBe(2);

    // =========================================================================
    // STEP 3: Unlock Personal Main & Verify Decrypted Plaintext
    // =========================================================================
    const sessionMain2 = vault2.unlockSpace('PasswordMain123!', envMain.spaceId);
    expect(sessionMain2.spaceId).toBe(envMain.spaceId);

    const recoveredMainProfile = await store2.getAsync<typeof mainProfile>(sessionMain2, 'profile');
    const recoveredMainChat = await store2.getAsync<typeof mainChat>(sessionMain2, 'chat_01');

    expect(recoveredMainProfile).toEqual(mainProfile);
    expect(recoveredMainChat).toEqual(mainChat);

    // =========================================================================
    // STEP 4: Verify Locked State Access Rejection
    // =========================================================================
    vault2.lockSpace(sessionMain2.spaceId);
    expect(sessionMain2.isActive()).toBe(false);
    await expect(store2.getAsync(sessionMain2, 'profile')).rejects.toThrow(/locked or destroyed/);

    // =========================================================================
    // STEP 5: Unlock Secret Work & Verify Cross-Space Isolation
    // =========================================================================
    const sessionWork2 = vault2.unlockSpace('PasswordWork456!', envWork.spaceId);
    const recoveredWorkProfile = await store2.getAsync<typeof workProfile>(sessionWork2, 'profile');
    const recoveredWorkSecret = await store2.getAsync<typeof workSecret>(sessionWork2, 'secret_doc');

    expect(recoveredWorkProfile).toEqual(workProfile);
    expect(recoveredWorkSecret).toEqual(workSecret);

    // Secret Work cannot read Personal Main's chat_01 record
    const crossSpaceRecord = await store2.getAsync(sessionWork2, 'chat_01');
    expect(crossSpaceRecord).toBeNull();

    // =========================================================================
    // STEP 6: Direct IndexedDB Inspection (Verify Zero Plaintext Leaks)
    // =========================================================================
    const rawEnvelopes = await adapter2.listEnvelopes();
    for (const env of rawEnvelopes) {
      // Must not contain plain password anywhere in JSON
      const json = JSON.stringify(env);
      expect(json).not.toContain('PasswordMain123!');
      expect(json).not.toContain('PasswordWork456!');
    }

    const rawRecords = await adapter2.listRecords(envMain.spaceId);
    expect(rawRecords.length).toBe(2);
    for (const rec of rawRecords) {
      // Ciphertext must be valid Base64 and not contain raw plaintext
      expect(rec.ciphertext).toBeTruthy();
      expect(rec.nonce).toHaveLength(32); // 24 bytes in Base64 = 32 chars
      expect(rec.ciphertext).not.toContain('Classified message');
      expect(rec.ciphertext).not.toContain('Alice Primary');
    }

    // =========================================================================
    // STEP 7: Tampering & Bit-Flipping Detection
    // =========================================================================
    // Intentionally corrupt a record in the database
    const targetRecord = await adapter2.getRecord(envMain.spaceId, 'chat_01');
    expect(targetRecord).not.toBeNull();

    // Corrupt ciphertext
    const corruptedCiphertext = targetRecord!.ciphertext.substring(0, targetRecord!.ciphertext.length - 4) + 'AAAA';
    await adapter2.saveRecord(envMain.spaceId, {
      ...targetRecord!,
      ciphertext: corruptedCiphertext,
    });

    // Fresh store instance reading from disk
    const store3 = new EncryptedSpaceStore(adapter2);
    const sessionMain3 = vault2.unlockSpace('PasswordMain123!', envMain.spaceId);
    await expect(store3.getAsync(sessionMain3, 'chat_01')).rejects.toThrow(/Decryption failed/);

    await adapter2.close();
  });
});

