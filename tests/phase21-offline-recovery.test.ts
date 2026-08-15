import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EnvelopeQueue } from '../src/network/envelopeQueue.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 21: Offline Queue & Restart Recovery Tests', () => {
  it('OFFLINE OUTBOUND RETENTION: Queued messages survive process restart and are retrievable', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Offline Space', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const store = new EncryptedSpaceStore(adapter);
    const queue = new EnvelopeQueue(store);

    await queue.enqueueOutbound(session, {
      queueId: 'q_123',
      spaceId: session.spaceId,
      mailboxId: 'mb_target_123',
      payload: 'CiphertextPayloadBase64',
      status: 'QUEUED',
      createdAt: Date.now(),
      retryCount: 0,
    });

    const pendingBefore = await queue.listOutbound(session);
    expect(pendingBefore).toHaveLength(1);

    // Simulate process termination
    session.destroy();
    expect(session.isActive()).toBe(false);

    // Re-unlock and verify queue survives in persistent adapter
    const reSession = vault.unlockSpace('Password123!', env.spaceId);
    const recoveredStore = new EncryptedSpaceStore(adapter);
    const recoveredQueue = new EnvelopeQueue(recoveredStore);

    const pendingAfter = await recoveredQueue.listOutbound(reSession);
    expect(pendingAfter).toHaveLength(1);
    expect(pendingAfter[0].mailboxId).toBe('mb_target_123');
    expect(pendingAfter[0].payload).toBe('CiphertextPayloadBase64');
  });
});
