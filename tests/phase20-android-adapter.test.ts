import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 20: Android Platform Adapter Simulation Tests', () => {
  it('STORAGE ADAPTER INVARIANTS: Android storage preserves encrypted records across lifecycle transitions', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Android Vault', password: 'AndroidPass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('AndroidPass123!', env.spaceId);

    const store = new EncryptedSpaceStore(adapter);
    await store.setAsync(session, 'lifecycle_state', { backgroundedAt: Date.now(), pushEnabled: true });

    // Simulate backgrounding & process restart
    session.destroy();
    expect(session.isActive()).toBe(false);

    // Re-unlock
    const reSession = vault.unlockSpace('AndroidPass123!', env.spaceId);
    const recoveredStore = new EncryptedSpaceStore(adapter);
    const state = await recoveredStore.getAsync<{ backgroundedAt: number; pushEnabled: boolean }>(reSession, 'lifecycle_state');

    expect(state?.pushEnabled).toBe(true);
    expect(state?.backgroundedAt).toBeGreaterThan(0);
  });
});
