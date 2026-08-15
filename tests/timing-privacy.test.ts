import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrafficShaper } from '../src/transport/trafficShaper.ts';
import { TransportEnvelope } from '../src/transport/types.ts';

describe('VEIL Phase 8: Timing Privacy & Jitter Scheduling Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TIMING JITTER: Applies bounded random delay in Balanced and High privacy levels', () => {
    const shaper = new TrafficShaper('balanced');
    const dummyEnv: TransportEnvelope = {
      envelopeId: 'env_01',
      mailboxId: 'mb_01',
      version: 1,
      payload: 'dummy_payload',
      sizeClass: 'SMALL',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    };

    let dispatchedEnvelopes: TransportEnvelope[] = [];
    const { scheduledDelayMs, immediate } = shaper.enqueue(dummyEnv, batch => {
      dispatchedEnvelopes = batch;
    });

    expect(immediate).toBe(false);
    expect(scheduledDelayMs).toBeGreaterThanOrEqual(20);
    expect(scheduledDelayMs).toBeLessThanOrEqual(120);
    expect(dispatchedEnvelopes.length).toBe(0);

    // Fast-forward timer by scheduledDelayMs
    vi.advanceTimersByTime(scheduledDelayMs);
    expect(dispatchedEnvelopes.length).toBe(1);
    expect(dispatchedEnvelopes[0].envelopeId).toBe('env_01');
  });

  it('STANDARD LEVEL: Dispatches immediately with zero delay', () => {
    const shaper = new TrafficShaper('standard');
    const dummyEnv: TransportEnvelope = {
      envelopeId: 'env_02',
      mailboxId: 'mb_02',
      version: 1,
      payload: 'dummy_payload',
      sizeClass: 'SMALL',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    };


    let dispatched = false;
    const { scheduledDelayMs, immediate } = shaper.enqueue(dummyEnv, () => {
      dispatched = true;
    });

    expect(immediate).toBe(true);
    expect(scheduledDelayMs).toBe(0);
    expect(dispatched).toBe(true);
  });
});
