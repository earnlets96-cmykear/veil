/**
 * Android & Mobile Network Connectivity and State Propagation Test Suite
 *
 * Validates real-time network state events, fallback transitions,
 * online/offline recovery, and listener lifecycle management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import type { NetworkState } from '../src/network/types.ts';

describe('Android Network Connectivity & State Propagation', () => {
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let netMgr: NetworkManager;
  let session: SpaceSession;

  beforeEach(() => {
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    netMgr = new NetworkManager(store, {
      httpUrl: 'http://127.0.0.1:0',
      wsUrl: 'ws://127.0.0.1:0/v1/ws',
      requestTimeoutMs: 1000,
    });
    session = new SpaceSession('test_space_mobile', 'Mobile Space', false, new Uint8Array(32).fill(1));
    idMgr.createIdentity(session, store);
  });

  it('initializes in offline state and emits initial state to subscriber', () => {
    const states: NetworkState[] = [];
    const unsub = netMgr.onStateChange((state) => {
      states.push(state);
    });

    expect(states).toEqual(['offline']);
    expect(netMgr.getState()).toBe('offline');

    unsub();
  });

  it('propagates state changes to all registered listeners', () => {
    const listener1States: NetworkState[] = [];
    const listener2States: NetworkState[] = [];

    const unsub1 = netMgr.onStateChange((s) => listener1States.push(s));
    const unsub2 = netMgr.onStateChange((s) => listener2States.push(s));

    // Simulate internal state transitions via private emit
    (netMgr as any).emitStateChange('connecting');
    (netMgr as any).emitStateChange('connected');
    (netMgr as any).emitStateChange('degraded');
    (netMgr as any).emitStateChange('reconnecting');
    (netMgr as any).emitStateChange('offline');

    expect(listener1States).toEqual(['offline', 'connecting', 'connected', 'degraded', 'reconnecting', 'offline']);
    expect(listener2States).toEqual(['offline', 'connecting', 'connected', 'degraded', 'reconnecting', 'offline']);

    unsub1();
    unsub2();
  });

  it('unsubscribes cleanly without impacting remaining listeners', () => {
    const listener1States: NetworkState[] = [];
    const listener2States: NetworkState[] = [];

    const unsub1 = netMgr.onStateChange((s) => listener1States.push(s));
    const unsub2 = netMgr.onStateChange((s) => listener2States.push(s));

    unsub1();

    (netMgr as any).emitStateChange('connected');

    expect(listener1States).toEqual(['offline']); // Did not receive 'connected'
    expect(listener2States).toEqual(['offline', 'connected']);

    unsub2();
  });

  it('emits offline state when stopListening halts all active sessions', () => {
    const states: NetworkState[] = [];
    const unsub = netMgr.onStateChange((s) => states.push(s));

    (netMgr as any).emitStateChange('connected');
    expect(netMgr.getState()).toBe('connected');

    netMgr.stopListening(session);

    expect(netMgr.getState()).toBe('offline');
    expect(states[states.length - 1]).toBe('offline');

    unsub();
  });

  it('handles state getter for specific active session vs global state', () => {
    expect(netMgr.getState(session)).toBe('offline');
    (netMgr as any).emitStateChange('connected');
    expect(netMgr.getState()).toBe('connected');
  });
});
