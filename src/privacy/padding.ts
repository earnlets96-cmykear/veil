/**
 * Standardized Size Bucket Padding for VEIL Phase 8.
 *
 * Implements deterministic message size quantization to prevent
 * traffic observers from inferring message content from packet lengths.
 */

import { getRandomBytes } from '../crypto/utils.ts';

/** Standardized size bucket classes in bytes (512B, 2KB, 8KB, 32KB, 64KB) */
export const PADDING_BUCKETS: readonly number[] = [512, 2048, 8192, 32768, 65536];

/** Hard limits to prevent DoS and memory exhaustion */
export const MAX_MESSAGE_SIZE = 64 * 1024;      // 64 KiB (65,536 bytes)
export const MAX_PADDED_SIZE = 128 * 1024;     // 128 KiB (131,072 bytes)

export class MessagePadding {
  /**
   * Calculates the target bucket size for a given raw payload length.
   */
  public static getBucketSize(payloadLength: number): number {
    if (payloadLength < 0 || payloadLength > MAX_MESSAGE_SIZE) {
      throw new Error(`Invalid payload size ${payloadLength} bytes: exceeds maximum allowed ${MAX_MESSAGE_SIZE} bytes`);
    }

    const requiredTotal = payloadLength + 2; // 2 bytes for length prefix

    for (const bucket of PADDING_BUCKETS) {
      if (bucket >= requiredTotal) {
        return bucket;
      }
    }

    // For payloads between 65534 and 65536, pad to next 64KB boundary (MAX_PADDED_SIZE)
    if (requiredTotal <= MAX_PADDED_SIZE) {
      return MAX_PADDED_SIZE;
    }

    throw new Error(`Payload requires ${requiredTotal} bytes which exceeds MAX_PADDED_SIZE (${MAX_PADDED_SIZE} bytes)`);
  }

  /**
   * Pads a payload into a standardized size bucket with random bytes.
   *
   * Format:
   * [ 2 bytes: uint16 big-endian original length ] [ N bytes: original payload ] [ M bytes: random padding ]
   */
  public static padMessage(payload: Uint8Array | string, explicitBucketSize?: number): Uint8Array {
    const rawBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;

    if (rawBytes.length > MAX_MESSAGE_SIZE) {
      throw new Error(`Message size (${rawBytes.length} bytes) exceeds MAX_MESSAGE_SIZE (${MAX_MESSAGE_SIZE} bytes)`);
    }

    const bucketSize = explicitBucketSize ?? this.getBucketSize(rawBytes.length);

    if (bucketSize < rawBytes.length + 2) {
      throw new Error(`Target bucket size ${bucketSize} is too small for payload length ${rawBytes.length} + 2 header bytes`);
    }
    if (bucketSize > MAX_PADDED_SIZE) {
      throw new Error(`Target bucket size ${bucketSize} exceeds MAX_PADDED_SIZE (${MAX_PADDED_SIZE} bytes)`);
    }

    const output = new Uint8Array(bucketSize);

    // 1. Write 2-byte big-endian original length
    output[0] = (rawBytes.length >> 8) & 0xff;
    output[1] = rawBytes.length & 0xff;

    // 2. Copy original payload
    output.set(rawBytes, 2);

    // 3. Fill remaining space with cryptographic random padding
    const paddingLength = bucketSize - (rawBytes.length + 2);
    if (paddingLength > 0) {
      const paddingBytes = getRandomBytes(paddingLength);
      output.set(paddingBytes, rawBytes.length + 2);
    }

    return output;
  }

  /**
   * Extracts the original payload from a padded envelope and validates bounds.
   */
  public static unpadMessage(padded: Uint8Array): Uint8Array {
    if (padded.length < 2) {
      throw new Error('Malformed padded message: buffer too short (< 2 bytes)');
    }
    if (padded.length > MAX_PADDED_SIZE) {
      throw new Error(`Malformed padded message: buffer length ${padded.length} exceeds MAX_PADDED_SIZE (${MAX_PADDED_SIZE})`);
    }

    const originalLength = (padded[0] << 8) | padded[1];

    if (originalLength > MAX_MESSAGE_SIZE) {
      throw new Error(`Malformed padded message: encoded length ${originalLength} exceeds MAX_MESSAGE_SIZE (${MAX_MESSAGE_SIZE})`);
    }
    if (originalLength + 2 > padded.length) {
      throw new Error(`Malformed padded message: encoded length ${originalLength} exceeds buffer capacity (${padded.length - 2} bytes)`);
    }

    return padded.slice(2, 2 + originalLength);
  }

  /**
   * Extracts and decodes the original string from a padded envelope.
   */
  public static unpadMessageToString(padded: Uint8Array): string {
    const unpaddedBytes = this.unpadMessage(padded);
    return new TextDecoder().decode(unpaddedBytes);
  }
}
