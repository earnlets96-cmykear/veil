/**
 * Memory hygiene utilities for VEIL.
 * Wipes sensitive key buffers to mitigate memory dump extraction.
 */

/**
 * Securely overwrites the given Uint8Array with zeros.
 */
export function zeroize(buffer: Uint8Array | null | undefined): void {
  if (buffer && buffer.length > 0) {
    buffer.fill(0);
  }
}

/**
 * Executes a function with sensitive key material and automatically zeroizes
 * the buffers in a finally block.
 */
export function withSecureBuffer<T>(
  length: number,
  fn: (buf: Uint8Array) => T
): T {
  const buf = new Uint8Array(length);
  try {
    return fn(buf);
  } finally {
    zeroize(buf);
  }
}
