import { describe, it, expect } from 'vitest';
import { TrafficShaper, TRAFFIC_LEVEL_CONFIGS } from '../src/transport/trafficShaper.ts';

describe('VEIL Phase 8: Traffic Privacy Levels & Parameters Tests', () => {
  it('should correctly configure Standard, Balanced, and High traffic privacy levels', () => {
    // 1. Standard
    const standard = new TrafficShaper('standard');
    expect(standard.getLevel()).toBe('standard');
    expect(TRAFFIC_LEVEL_CONFIGS.standard.minJitterMs).toBe(0);
    expect(TRAFFIC_LEVEL_CONFIGS.standard.maxBatchSize).toBe(1);

    // 2. Balanced
    const balanced = new TrafficShaper('balanced');
    expect(balanced.getLevel()).toBe('balanced');
    expect(TRAFFIC_LEVEL_CONFIGS.balanced.minJitterMs).toBe(20);
    expect(TRAFFIC_LEVEL_CONFIGS.balanced.maxJitterMs).toBe(120);
    expect(TRAFFIC_LEVEL_CONFIGS.balanced.maxBatchSize).toBe(3);

    // 3. High
    const high = new TrafficShaper('high');
    expect(high.getLevel()).toBe('high');
    expect(TRAFFIC_LEVEL_CONFIGS.high.minJitterMs).toBe(100);
    expect(TRAFFIC_LEVEL_CONFIGS.high.maxJitterMs).toBe(400);
    expect(TRAFFIC_LEVEL_CONFIGS.high.maxBatchSize).toBe(5);

    // 4. Update level dynamically
    standard.setLevel('high');
    expect(standard.getLevel()).toBe('high');
  });
});
