import { describe, it, expect } from 'vitest';
import { TrafficShaper } from '../src/transport/trafficShaper.ts';
import { TransportEnvelope } from '../src/transport/types.ts';

describe('VEIL Phase 8: Transport Privacy & Batching Tests', () => {
  it('BATCHING: Flushes immediately when batch threshold is reached', () => {
    const shaper = new TrafficShaper('high'); // maxBatchSize = 5

    let dispatchedBatches: TransportEnvelope[][] = [];

    const makeEnv = (id: string): TransportEnvelope => ({
      envelopeId: id,
      mailboxId: 'mb_01',
      version: 1,
      payload: `payload_${id}`,
      sizeClass: 'SMALL',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });

    // Enqueue 4 envelopes (below threshold 5)
    shaper.enqueue(makeEnv('env_1'), batch => { dispatchedBatches.push(batch); });
    shaper.enqueue(makeEnv('env_2'), batch => { dispatchedBatches.push(batch); });
    shaper.enqueue(makeEnv('env_3'), batch => { dispatchedBatches.push(batch); });
    shaper.enqueue(makeEnv('env_4'), batch => { dispatchedBatches.push(batch); });
    expect(dispatchedBatches.length).toBe(0);
    expect(shaper.getQueueLength()).toBe(4);

    // Enqueue 5th envelope -> triggers batch dispatch
    shaper.enqueue(makeEnv('env_5'), batch => { dispatchedBatches.push(batch); });

    expect(dispatchedBatches.length).toBe(1);
    expect(dispatchedBatches[0].length).toBe(5);
    expect(shaper.getQueueLength()).toBe(0);
  });
});
