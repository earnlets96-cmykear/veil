import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 21: Android Platform Storage Boundary Audit', () => {
  it('STORAGE ISOLATION: Locked Space throws on unauthenticated access', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Private Android Space', password: 'SafePassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('SafePassword123!', env.spaceId);

    const store = new EncryptedSpaceStore(adapter);
    await store.setAsync(session, 'confidential', { data: 'SecretData' });

    // Destroy session
    session.destroy();
    expect(session.isActive()).toBe(false);

    // Attempting getAsync without valid session fails
    await expect(store.getAsync(session, 'confidential')).rejects.toThrow();
  });
});
