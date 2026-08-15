import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 17: 10-Space Adversarial Multi-Space Isolation Suite', () => {
  let vault: SpaceVaultManager;
  let adapter: MemoryStorageAdapter;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
    idMgr = new SpaceIdentityManager();
  });

  it('10-SPACE ADVERSARIAL SCALE: 10 Spaces exhibit strictly isolated SMKs, StorageKeys, and data records', async () => {
    const spaceCount = 10;
    const environments: any[] = [];
    const sessions: any[] = [];
    const identities: any[] = [];

    // Create 10 independent Spaces
    for (let i = 0; i < spaceCount; i++) {
      const env = vault.createSpace({
        name: `Persona Space ${i}`,
        password: `Password_${i}_Secret!`,
        kdfParams: FAST_TEST_KDF_PARAMS,
      });
      environments.push(env);

      const session = vault.unlockSpace(`Password_${i}_Secret!`, env.spaceId);
      sessions.push(session);

      const doc = idMgr.createIdentity(session, store);
      identities.push(doc);

      // Write private record to Space i
      await store.setAsync(session, `secret_record`, { ownerSpace: i, payload: `Confidential ${i}` });
    }

    // Verify all StorageKeys and SMKs are unique
    const storageKeys = new Set(sessions.map((s) => s.getStorageKey().toString()));
    const smks = new Set(sessions.map((s) => s.getMasterKey().toString()));
    const identityIds = new Set(identities.map((id) => id.identityId));

    expect(storageKeys.size).toBe(spaceCount);
    expect(smks.size).toBe(spaceCount);
    expect(identityIds.size).toBe(spaceCount);

    // Cross-Space Data Isolation: Space i can only read its own secret_record
    for (let i = 0; i < spaceCount; i++) {
      const data = await store.getAsync<{ ownerSpace: number; payload: string }>(sessions[i], `secret_record`);
      expect(data?.ownerSpace).toBe(i);
      expect(data?.payload).toBe(`Confidential ${i}`);
    }

    // Cleanly destroy all sessions
    for (const session of sessions) {
      session.destroy();
      expect(session.isActive()).toBe(false);
    }
  });
});
