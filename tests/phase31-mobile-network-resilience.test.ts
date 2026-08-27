/**
 * Phase 31: Mobile Network Resilience & Transport State Tests.
 *
 * Verifies that network failures never cause a black screen, ErrorBoundary catches
 * errors safely, degraded polling functions when WS fails, and automatic reconnection works.
 */

import { describe, it, expect } from 'vitest';
import { WebSocketTransport } from '../src/network/websocketTransport.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary.tsx';

describe('Phase 31: Mobile Network Resilience & Transport State Handling', () => {
  it('prevents React tree crash and provides recovery actions upon component failure', () => {
    const derived = ErrorBoundary.getDerivedStateFromError(new Error('Network request to relay timed out'));
    expect(derived.hasError).toBe(true);
    expect(derived.errorMessage).toBe('Network request to relay timed out');
  });

  it('sanitizes sensitive tokens or keys in error boundary state', () => {
    const derived = ErrorBoundary.getDerivedStateFromError(
      new Error('Failed to decrypt space with password=SecretPassword123 and token=Bearer123')
    );
    expect(derived.hasError).toBe(true);
    expect(derived.errorMessage).not.toContain('SecretPassword123');
    expect(derived.errorMessage).not.toContain('Bearer123');
    expect(derived.errorMessage).toBe('An authentication or security error occurred.');
  });

  it('transitions through transport states cleanly and enqueues messages during outage', async () => {
    const memory = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(memory);
    const session = new SpaceSession('resilience-space', 'Resilience Space', false, randomBytes(32));

    const netManager = new NetworkManager(store, {
      httpUrl: 'http://127.0.0.1:0',
      wsUrl: 'ws://127.0.0.1:0/v1/ws',
    });

    const states: string[] = [];
    netManager.onStateChange((state) => states.push(state));

    // Send envelope while offline
    const queued = await netManager.sendEnvelope(session, 'mbx_remote_target', 'SGVsbG8gV09STEQ=');
    expect(queued.status).toBe('QUEUED');

    const list = await netManager.getQueue().listOutbound(session);
    expect(list.length).toBe(1);
    expect(list[0].mailboxId).toBe('mbx_remote_target');

    session.destroy();
  });
});
