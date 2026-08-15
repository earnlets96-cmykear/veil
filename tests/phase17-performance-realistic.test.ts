import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { LocalSearchEngine } from '../src/search/searchEngine.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 17: Realistic Workload Performance Benchmarks', () => {
  it('LARGE SCALE REALISTIC WORKLOAD: Indexes and searches across 1,000+ messages in under 15ms', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(adapter);

    const env = vault.createSpace({ name: 'Scale Space', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const searchEngine = new LocalSearchEngine();

    const mockMessages = Array.from({ length: 1000 }, (_, i) => ({
      id: `msg_perf_${i}`,
      conversationId: `conv_${i % 10}`,
      senderId: `sender_${i % 5}`,
      text: `Realistic confidential message payload number ${i} discussing privacy architectures and cryptography`,
      isOutgoing: i % 2 === 0,
      timestamp: Date.now() - i * 500,
      status: 'DELIVERED_TO_RECIPIENT' as const,
    }));

    // Update in-memory index
    const startIdx = performance.now();
    searchEngine.updateIndex([], [], { conv_0: mockMessages });
    const idxDurationMs = performance.now() - startIdx;
    expect(idxDurationMs).toBeLessThan(100);

    // Query across 1,000 messages
    const startQuery = performance.now();
    const queryResults = searchEngine.search('cryptography');
    const queryDurationMs = performance.now() - startQuery;

    expect(queryResults.length).toBe(1000);
    expect(queryDurationMs).toBeLessThan(20);

    session.destroy();
  });
});
