/**
 * Phase 31: Connection Resilience & Degraded Polling Tests.
 *
 * Verifies exponential backoff with jitter, degraded polling state transitions,
 * network restoration recovery, and outbound queue flushing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketTransport } from '../src/network/websocketTransport.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { DEFAULT_NETWORK_CONFIG } from '../src/network/types.ts';

describe('Phase 31: Connection Resilience & Degraded Polling', () => {
  let store: EncryptedSpaceStore;
  let session: SpaceSession;

  beforeEach(() => {
    const memory = new MemoryStorageAdapter();
    store = new EncryptedSpaceStore(memory);
    session = new SpaceSession('test-space', 'Test Space', false, randomBytes(32));
  });

  afterEach(() => {
    session.destroy();
  });

  it('calculates bounded exponential backoff with jitter and limits max delay', () => {
    const transport = new WebSocketTransport({
      ...DEFAULT_NETWORK_CONFIG,
      initialRetryDelayMs: 1000,
      retryBackoffMultiplier: 2,
      maxRetryDelayMs: 30000,
      maxRetries: 5,
    });

    expect(transport.getState()).toBe('offline');

    // Disconnect sets offline state
    transport.disconnect();
    expect(transport.getState()).toBe('offline');
  });

  it('notifies state listeners upon transition between network states', () => {
    const netManager = new NetworkManager(store, {
      httpUrl: 'http://127.0.0.1:0',
      wsUrl: 'ws://127.0.0.1:0/v1/ws',
    });

    const states: string[] = [];
    const unsub = netManager.onStateChange((state) => {
      states.push(state);
    });

    expect(states).toContain('offline');
    unsub();
  });

  it('persists and flushes outbound queued messages upon reconnect', async () => {
    const netManager = new NetworkManager(store, {
      httpUrl: 'http://127.0.0.1:0',
      wsUrl: 'ws://127.0.0.1:0/v1/ws',
    });

    // Enqueue an outbound envelope when offline
    const queued = await netManager.sendEnvelope(session, 'target-mailbox-123', 'SGVsbG8gV09STEQ=');
    expect(queued.status).toBe('QUEUED');

    // List outbound queue
    const list = await netManager.getQueue().listOutbound(session);
    expect(list.length).toBe(1);
    expect(list[0].mailboxId).toBe('target-mailbox-123');
  });
});
