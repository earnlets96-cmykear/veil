import { describe, it, expect } from 'vitest';
import { MessagePadding, MAX_MESSAGE_SIZE, MAX_PADDED_SIZE } from '../src/privacy/padding.ts';

describe('VEIL Phase 8: Resource Limits & Memory Exhaustion Defenses', () => {
  it('RESOURCE LIMITS: Enforces MAX_MESSAGE_SIZE and MAX_PADDED_SIZE to prevent DoS', () => {
    // 1. Oversized message exceeds 64 KiB limit
    const oversizedPayload = new Uint8Array(MAX_MESSAGE_SIZE + 1);
    expect(() => MessagePadding.padMessage(oversizedPayload)).toThrow(/exceeds MAX_MESSAGE_SIZE/);

    // 2. Maximum permitted size (64 KiB) pads successfully
    const validMaxPayload = new Uint8Array(MAX_MESSAGE_SIZE - 2);
    const padded = MessagePadding.padMessage(validMaxPayload);
    expect(padded.length).toBeLessThanOrEqual(MAX_PADDED_SIZE);
    expect(MessagePadding.unpadMessage(padded).length).toBe(MAX_MESSAGE_SIZE - 2);

    // 3. Reject padded message exceeding MAX_PADDED_SIZE
    const hugePadded = new Uint8Array(MAX_PADDED_SIZE + 10);
    expect(() => MessagePadding.unpadMessage(hugePadded)).toThrow(/exceeds MAX_PADDED_SIZE/);
  });
});
