import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { DeliveryStatus } from '../src/network/types.ts';

describe('VEIL Phase 15: Production Message Lifecycle & State Machine Tests', () => {
  let vault: SpaceVaultManager;
  let adapter: MemoryStorageAdapter;
  let store: EncryptedSpaceStore;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
  });

  it('STATE TRANSITIONS: Tracks message status progression through lifecycle', async () => {
    const env = vault.createSpace({ name: 'Personal', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const msgId = 'msg_lifecycle_01';
    let msgRecord: {
      id: string;
      conversationId: string;
      senderId: string;
      text: string;
      status: DeliveryStatus;
      timestamp: number;
    } = {
      id: msgId,
      conversationId: 'peer_bob',
      senderId: session.spaceId,
      text: 'Lifecycle message',
      status: 'QUEUED',
      timestamp: Date.now(),
    };

    // Commit QUEUED
    await store.setAsync(session, `veil:msg:${msgId}`, msgRecord);
    expect((await store.getAsync<typeof msgRecord>(session, `veil:msg:${msgId}`))?.status).toBe('QUEUED');

    // Transition SENDING -> SENT_TO_RELAY -> DELIVERED_TO_RECIPIENT
    msgRecord = { ...msgRecord, status: 'SENT_TO_RELAY' };
    await store.setAsync(session, `veil:msg:${msgId}`, msgRecord);
    expect((await store.getAsync<typeof msgRecord>(session, `veil:msg:${msgId}`))?.status).toBe('SENT_TO_RELAY');

    msgRecord = { ...msgRecord, status: 'DELIVERED_TO_RECIPIENT' };
    await store.setAsync(session, `veil:msg:${msgId}`, msgRecord);
    expect((await store.getAsync<typeof msgRecord>(session, `veil:msg:${msgId}`))?.status).toBe('DELIVERED_TO_RECIPIENT');
  });
});
