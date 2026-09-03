/**
 * Deterministic Size-Class Padding for VEIL Transport.
 *
 * Implements length-prefixed size normalization to mitigate packet size analysis.
 * Format of padded block:
 *   [ 4-byte big-endian payload length L ] || [ L payload bytes ] || [ Padding bytes ]
 * Total length is guaranteed to match one of the defined SizeClasses (512, 2048, 8192, 32768).
 */

import { SizeClass, SIZE_CLASS_BYTES, MAX_PAYLOAD_BYTES } from './types.ts';
import { randomBytes } from '../crypto/utils.ts';

export interface PaddedResult {
  padded: Uint8Array;
  sizeClass: SizeClass;
}

const SIZE_CLASS_ORDER: SizeClass[] = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE', 'JUMBO'];

/**
 * Pads a payload to the smallest fitting SizeClass.
 *
 * @param payload Raw payload bytes
 * @returns Padded bytes and the selected SizeClass
 * @throws Error if payload exceeds maximum supported transport size
 */
export function padPayload(payload: Uint8Array): PaddedResult {
  const payloadLen = payload.length;
  const totalNeeded = payloadLen + 4; // 4-byte length prefix

  if (payloadLen > MAX_PAYLOAD_BYTES) {
    throw new Error(`Payload exceeds maximum allowed size (${MAX_PAYLOAD_BYTES} bytes): got ${payloadLen} bytes`);
  }

  // Find the smallest fitting size class
  let targetClass: SizeClass = 'JUMBO';
  let targetBytes = SIZE_CLASS_BYTES.JUMBO;

  for (const sc of SIZE_CLASS_ORDER) {
    if (SIZE_CLASS_BYTES[sc] >= totalNeeded) {
      targetClass = sc;
      targetBytes = SIZE_CLASS_BYTES[sc];
      break;
    }
  }

  const padded = new Uint8Array(targetBytes);

  // Write 4-byte big-endian length prefix
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  view.setUint32(0, payloadLen, false);

  // Copy payload bytes
  padded.set(payload, 4);

  // Fill remaining bytes with cryptographically secure random padding
  const paddingLen = targetBytes - totalNeeded;
  if (paddingLen > 0) {
    const padBytes = randomBytes(paddingLen);
    padded.set(padBytes, totalNeeded);
  }

  return { padded, sizeClass: targetClass };
}

/**
 * Validates and unpads a size-normalized transport block.
 *
 * @param padded The padded byte array
 * @returns Extracted original payload bytes
 * @throws Error if padding format, length prefix, or size class is invalid
 */
export function unpadPayload(padded: Uint8Array): Uint8Array {
  if (padded.length < 4) {
    throw new Error('Unpadding failed: buffer too small for length prefix');
  }

  // Verify that the total length corresponds to one of the defined size classes
  const validSize = Object.values(SIZE_CLASS_BYTES).includes(padded.length);
  if (!validSize) {
    throw new Error(`Unpadding failed: invalid block size ${padded.length} (does not match any size class)`);
  }

  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const payloadLen = view.getUint32(0, false);

  if (payloadLen > padded.length - 4) {
    throw new Error(`Unpadding failed: declared payload length ${payloadLen} exceeds block capacity ${padded.length - 4}`);
  }

  // Extract payload slice
  return padded.slice(4, 4 + payloadLen);
}
