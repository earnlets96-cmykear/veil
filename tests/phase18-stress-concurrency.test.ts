import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 18: High-Concurrency & Stress Test Suite', () => {
  let adapter: MemoryStorageAdapter;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
  });

  it('CONCURRENT MESSAGE BURST: Processes 500 concurrent encrypted messages with zero data corruption', async () => {
    const env = vault.createSpace({ name: 'Stress Space', password: 'StressPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('StressPassword123!', env.spaceId);

    const messageCount = 500;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < messageCount; i++) {
      const p = store.setAsync(session, `msg_${i}`, {
        index: i,
        content: `Concurrent stress message payload ${i}`,
        timestamp: Date.now(),
      });
      promises.push(p);
    }

    await Promise.all(promises);

    // Verify all 500 records are intact and decryptable
    const readPromises: Promise<any>[] = [];
    for (let i = 0; i < messageCount; i++) {
      readPromises.push(store.getAsync(session, `msg_${i}`));
    }

    const results = await Promise.all(readPromises);
    expect(results).toHaveLength(messageCount);
    for (let i = 0; i < messageCount; i++) {
      expect(results[i]?.index).toBe(i);
      expect(results[i]?.content).toBe(`Concurrent stress message payload ${i}`);
    }

    session.destroy();
  });

  it('RAPID SPACE SWITCHING STRESS: Switches rapidly across 5 Spaces under active operations', async () => {
    const spaceCount = 5;
    const envs = Array.from({ length: spaceCount }, (_, i) =>
      vault.createSpace({ name: `Switch Space ${i}`, password: `Pass${i}!`, kdfParams: FAST_TEST_KDF_PARAMS })
    );

    // Rapidly open, write, and destroy sessions
    for (let cycle = 0; cycle < 10; cycle++) {
      const targetIdx = cycle % spaceCount;
      const targetEnv = envs[targetIdx];
      const session = vault.unlockSpace(`Pass${targetIdx}!`, targetEnv.spaceId);

      await store.setAsync(session, `cycle_${cycle}`, { cycle, targetIdx });
      const record = await store.getAsync<{ cycle: number; targetIdx: number }>(session, `cycle_${cycle}`);
      expect(record?.cycle).toBe(cycle);

      session.destroy();
      expect(session.isActive()).toBe(false);
    }
  });

  it('HIGH THROUGHPUT SYMMETRIC RATCHET BURST: Encrypts & decrypts 1,000 continuous ratchet payloads', () => {
    const key = randomBytes(32);
    const count = 1000;
    const plaintext = new TextEncoder().encode('Continuous ratchet burst message test payload');

    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const aad = new TextEncoder().encode(`seq_${i}`);
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, plaintext, aad);
      const decrypted = decryptXChaCha20Poly1305(key, nonce, ciphertext, aad);
      expect(decrypted).toEqual(plaintext);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000); // 1,000 AEAD operations in < 1 second
  });
});
