import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 19: 20-Space Final Isolation Scale Gate', () => {
  let adapter: MemoryStorageAdapter;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
  });

  it('20-SPACE SCALE ISOLATION: 20 simultaneous Spaces exhibit 0% cross-talk or key leakage', async () => {
    const spaceCount = 20;
    const envs = [];
    const sessions = [];

    for (let i = 0; i < spaceCount; i++) {
      const env = vault.createSpace({
        name: `Persona_${i}`,
        password: `Password_${i}_Gate!`,
        kdfParams: FAST_TEST_KDF_PARAMS,
      });
      envs.push(env);

      const session = vault.unlockSpace(`Password_${i}_Gate!`, env.spaceId);
      sessions.push(session);

      await store.setAsync(session, 'space_secret', { index: i, value: `Data_${i}` });
    }

    // Verify all 20 StorageKeys and SMKs are unique
    const storageKeys = new Set(sessions.map((s) => s.getStorageKey().toString()));
    const smks = new Set(sessions.map((s) => s.getMasterKey().toString()));

    expect(storageKeys.size).toBe(spaceCount);
    expect(smks.size).toBe(spaceCount);

    // Verify data isolation
    for (let i = 0; i < spaceCount; i++) {
      const data = await store.getAsync<{ index: number; value: string }>(sessions[i], 'space_secret');
      expect(data?.index).toBe(i);
      expect(data?.value).toBe(`Data_${i}`);
    }

    // Clean up
    for (const session of sessions) {
      session.destroy();
      expect(session.isActive()).toBe(false);
    }
  });
});
