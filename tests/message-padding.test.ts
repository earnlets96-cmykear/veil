import { describe, it, expect } from 'vitest';
import { MessagePadding, PADDING_BUCKETS } from '../src/privacy/padding.ts';

describe('VEIL Phase 8: Standardized Size Bucket Padding Tests', () => {
  it('should quantize messages of varying lengths into discrete size buckets', () => {
    const tiny = 'hi';
    const small = 'hello world this is a short test message';
    const medium = 'A'.repeat(1500);
    const large = 'B'.repeat(5000);
    const xl = 'C'.repeat(25000);

    const paddedTiny = MessagePadding.padMessage(tiny);
    const paddedSmall = MessagePadding.padMessage(small);
    const paddedMed = MessagePadding.padMessage(medium);
    const paddedLarge = MessagePadding.padMessage(large);
    const paddedXl = MessagePadding.padMessage(xl);

    // Discrete bucket allocations
    expect(paddedTiny.length).toBe(512);
    expect(paddedSmall.length).toBe(512);
    expect(paddedMed.length).toBe(2048);
    expect(paddedLarge.length).toBe(8192);
    expect(paddedXl.length).toBe(32768);

    // Unpadding exactness
    expect(MessagePadding.unpadMessageToString(paddedTiny)).toBe(tiny);
    expect(MessagePadding.unpadMessageToString(paddedSmall)).toBe(small);
    expect(MessagePadding.unpadMessageToString(paddedMed)).toBe(medium);
    expect(MessagePadding.unpadMessageToString(paddedLarge)).toBe(large);
    expect(MessagePadding.unpadMessageToString(paddedXl)).toBe(xl);
  });

  it('should reject malformed padding envelopes with invalid lengths or buffer overflows', () => {
    // 1. Buffer too short
    expect(() => MessagePadding.unpadMessage(new Uint8Array(1))).toThrow(/too short/);

    // 2. Corrupted length header claiming more bytes than buffer capacity
    const corrupted = new Uint8Array(512);
    corrupted[0] = 0x03; // length = 0x03E8 = 1000 bytes in a 512 byte buffer
    corrupted[1] = 0xe8;
    expect(() => MessagePadding.unpadMessage(corrupted)).toThrow(/exceeds buffer capacity/);
  });
});
