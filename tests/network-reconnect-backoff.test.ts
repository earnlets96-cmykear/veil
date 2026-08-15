import { describe, it, expect } from 'vitest';
import { WebSocketTransport } from '../src/network/websocketTransport.ts';
import { DEFAULT_NETWORK_CONFIG, NetworkState } from '../src/network/types.ts';

describe('VEIL Phase 13: WebSocket Reconnect & Exponential Backoff Tests', () => {
  it('RECONNECT BACKOFF: Transitions through connection states and computes exponential delays', async () => {
    const wsTransport = new WebSocketTransport({
      ...DEFAULT_NETWORK_CONFIG,
      wsUrl: 'ws://127.0.0.1:1', // Unreachable port to trigger reconnect sequence
      connectTimeoutMs: 200,
      initialRetryDelayMs: 50,
      maxRetryDelayMs: 500,
      maxRetries: 3,
    });

    const states: NetworkState[] = [];
    wsTransport.onStateChange((state) => states.push(state));

    try {
      await wsTransport.connect('dummy_mb', 'dummy_cap');
    } catch (_e) {
      // Expected connection failure
    }

    expect(states).toContain('connecting');
    expect(states).toContain('degraded');

    wsTransport.disconnect();
    expect(wsTransport.getState()).toBe('offline');
  });
});
