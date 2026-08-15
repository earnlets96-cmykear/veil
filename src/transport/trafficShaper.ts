/**
 * Traffic Shaper & Timing Obfuscator for VEIL Phase 8.
 *
 * Implements bounded timing jitter, envelope batching queues,
 * and traffic privacy levels (Standard, Balanced, High).
 */

import { TransportEnvelope } from './types.ts';

export type TrafficPrivacyLevel = 'standard' | 'balanced' | 'high';

export interface TrafficShaperConfig {
  level: TrafficPrivacyLevel;
  minJitterMs: number;
  maxJitterMs: number;
  maxBatchSize: number;
}

export const TRAFFIC_LEVEL_CONFIGS: Record<TrafficPrivacyLevel, TrafficShaperConfig> = {
  standard: {
    level: 'standard',
    minJitterMs: 0,
    maxJitterMs: 0,
    maxBatchSize: 1,
  },
  balanced: {
    level: 'balanced',
    minJitterMs: 20,
    maxJitterMs: 120,
    maxBatchSize: 3,
  },
  high: {
    level: 'high',
    minJitterMs: 100,
    maxJitterMs: 400,
    maxBatchSize: 5,
  },
};

export class TrafficShaper {
  private config: TrafficShaperConfig;
  private batchQueue: TransportEnvelope[] = [];
  private flushTimer: NodeJS.Timeout | number | null = null;

  constructor(level: TrafficPrivacyLevel = 'balanced') {
    this.config = { ...TRAFFIC_LEVEL_CONFIGS[level] };
  }

  public getLevel(): TrafficPrivacyLevel {
    return this.config.level;
  }

  public setLevel(level: TrafficPrivacyLevel): void {
    this.config = { ...TRAFFIC_LEVEL_CONFIGS[level] };
  }

  /**
   * Computes a random jitter delay within the configured bounds.
   */
  public computeJitterDelay(): number {
    if (this.config.maxJitterMs <= this.config.minJitterMs) {
      return this.config.minJitterMs;
    }
    const delta = this.config.maxJitterMs - this.config.minJitterMs;
    return this.config.minJitterMs + Math.floor(Math.random() * (delta + 1));
  }

  /**
   * Enqueues an envelope for delivery, applying batching and jitter.
   */
  public enqueue(
    envelope: TransportEnvelope,
    onDispatch: (envelopes: TransportEnvelope[]) => void | Promise<void>
  ): { scheduledDelayMs: number; immediate: boolean } {
    this.batchQueue.push(envelope);

    // If batch size threshold reached, flush immediately
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      this.cancelFlushTimer();
      const batch = [...this.batchQueue];
      this.batchQueue = [];
      onDispatch(batch);
      return { scheduledDelayMs: 0, immediate: true };
    }

    // Otherwise, schedule flush with jitter delay
    const delay = this.computeJitterDelay();

    if (delay === 0) {
      const batch = [...this.batchQueue];
      this.batchQueue = [];
      onDispatch(batch);
      return { scheduledDelayMs: 0, immediate: true };
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        const batch = [...this.batchQueue];
        this.batchQueue = [];
        if (batch.length > 0) {
          onDispatch(batch);
        }
      }, delay);
    }

    return { scheduledDelayMs: delay, immediate: false };
  }

  /**
   * Immediately flushes any pending envelopes in the queue.
   */
  public flush(onDispatch: (envelopes: TransportEnvelope[]) => void): void {
    this.cancelFlushTimer();
    if (this.batchQueue.length > 0) {
      const batch = [...this.batchQueue];
      this.batchQueue = [];
      onDispatch(batch);
    }
  }

  public getQueueLength(): number {
    return this.batchQueue.length;
  }

  private cancelFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer as any);
      this.flushTimer = null;
    }
  }
}
