import { describe, it, expect } from 'vitest';
import { padPayload, unpadPayload } from '../src/transport/padding.ts';
import { SIZE_CLASS_BYTES, MAX_PAYLOAD_BYTES } from '../src/transport/types.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 3: Size-Class Padding & Unpadding Tests', () => {
  it('should pad small payloads to exactly 512 bytes (SMALL class)', () => {
    const payload = new TextEncoder().encode('Hello VEIL!');
    const { padded, sizeClass } = padPayload(payload);

    expect(sizeClass).toBe('SMALL');
    expect(padded.length).toBe(SIZE_CLASS_BYTES.SMALL);

    const recovered = unpadPayload(padded);
    expect(new TextDecoder().decode(recovered)).toBe('Hello VEIL!');
  });

  it('should select correct size class across boundary sizes', () => {
    // 500 bytes -> SMALL (512)
    const p500 = randomBytes(500);
    expect(padPayload(p500).sizeClass).toBe('SMALL');
    expect(padPayload(p500).padded.length).toBe(512);

    // 509 bytes -> exceeds 508 max payload for SMALL -> MEDIUM (2048)
    const p509 = randomBytes(509);
    expect(padPayload(p509).sizeClass).toBe('MEDIUM');
    expect(padPayload(p509).padded.length).toBe(2048);

    // 2045 bytes -> LARGE (8192)
    const p2045 = randomBytes(2045);
    expect(padPayload(p2045).sizeClass).toBe('LARGE');
    expect(padPayload(p2045).padded.length).toBe(8192);

    // 8189 bytes -> XLARGE (32768)
    const p8189 = randomBytes(8189);
    expect(padPayload(p8189).sizeClass).toBe('XLARGE');
    expect(padPayload(p8189).padded.length).toBe(32768);
  });

  it('should reject payloads exceeding MAX_PAYLOAD_BYTES', () => {
    const tooLarge = randomBytes(MAX_PAYLOAD_BYTES + 1);
    expect(() => padPayload(tooLarge)).toThrow(/exceeds maximum allowed size/);
  });

  it('should safely reject corrupted or malformed padding without crashing', () => {
    // Arbitrary unpadded buffer not matching size class
    expect(() => unpadPayload(new Uint8Array(100))).toThrow(/invalid block size/);

    // Block with declared length greater than capacity
    const badPadded = new Uint8Array(512);
    const view = new DataView(badPadded.buffer);
    view.setUint32(0, 9999, false); // declared length = 9999
    expect(() => unpadPayload(badPadded)).toThrow(/exceeds block capacity/);
  });
});
