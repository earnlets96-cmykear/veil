/**
 * Cryptographic utility functions for VEIL.
 *
 * Provides high-performance, memory-safe, cross-platform Base64 / Base64URL
 * codecs, cryptographically secure random generators, and constant-time comparisons.
 */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Build reverse lookup table for fast Base64 / Base64URL decoding
const B64_LOOKUP = new Uint8Array(256);
B64_LOOKUP.fill(255); // 255 = invalid character marker

for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}
// Support URL-safe variants in lookup
B64_LOOKUP['-'.charCodeAt(0)] = 62;
B64_LOOKUP['_'.charCodeAt(0)] = 63;

/**
 * Generates cryptographically secure random bytes.
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const MAX_CHUNK = 65536;
    for (let offset = 0; offset < length; offset += MAX_CHUNK) {
      const chunk = bytes.subarray(offset, Math.min(offset + MAX_CHUNK, length));
      crypto.getRandomValues(chunk);
    }
  } else {
    // Fallback for Node environment if global crypto is accessed
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(bytes);
  }
  return bytes;
}

export const getRandomBytes = randomBytes;

/**
 * Encodes Uint8Array to standard Base64 string with padding.
 * Chunked encoding prevents maximum call-stack errors on large buffers.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';

  const len = bytes.length;
  const extraBytes = len % 3;
  const mainLen = len - extraBytes;
  const parts: string[] = [];
  const CHUNK_SIZE = 16383; // Multiple of 3 for clean chunk boundaries

  for (let c = 0; c < mainLen; c += CHUNK_SIZE) {
    const end = Math.min(c + CHUNK_SIZE, mainLen);
    let chunkStr = '';
    for (let i = c; i < end; i += 3) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      chunkStr +=
        B64_CHARS[(b0 >> 2) & 0x3f] +
        B64_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f] +
        B64_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f] +
        B64_CHARS[b2 & 0x3f];
    }
    parts.push(chunkStr);
  }

  // Handle trailing 1 or 2 bytes with standard padding
  if (extraBytes === 1) {
    const b0 = bytes[mainLen];
    parts.push(
      B64_CHARS[(b0 >> 2) & 0x3f] +
      B64_CHARS[(b0 << 4) & 0x3f] +
      '=='
    );
  } else if (extraBytes === 2) {
    const b0 = bytes[mainLen];
    const b1 = bytes[mainLen + 1];
    parts.push(
      B64_CHARS[(b0 >> 2) & 0x3f] +
      B64_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f] +
      B64_CHARS[(b1 << 2) & 0x3f] +
      '='
    );
  }

  return parts.join('');
}

/**
 * Encodes Uint8Array to URL-safe Base64 string without padding.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes standard or URL-safe Base64 string to Uint8Array.
 * Handles missing padding, whitespace, and URL-safe characters safely without throwing Window atob errors.
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== 'string') return new Uint8Array(0);

  // Clean whitespace
  const clean = base64.replace(/[\s\r\n\t]/g, '');
  if (clean.length === 0) return new Uint8Array(0);

  // Calculate padding and length
  let validLen = clean.length;
  let padding = 0;

  while (validLen > 0 && clean[validLen - 1] === '=') {
    padding++;
    validLen--;
  }

  // Calculate expected output byte length
  const totalChars = clean.length;
  // If unpadded, compute implied padding
  const mod4 = totalChars % 4;
  const effectiveLen = mod4 === 0 ? totalChars : totalChars + (4 - mod4);
  const effectivePadding = mod4 === 0 ? padding : (4 - mod4);
  const outLen = Math.floor((effectiveLen * 3) / 4) - effectivePadding;

  const result = new Uint8Array(Math.max(0, outLen));
  let outIdx = 0;
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < validLen; i++) {
    const code = clean.charCodeAt(i);
    const val = code < 256 ? B64_LOOKUP[code] : 255;

    if (val === 255) {
      throw new Error(`Invalid Base64 character at index ${i}: '${clean[i]}'`);
    }

    buffer = (buffer << 6) | val;
    bitsCollected += 6;

    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      if (outIdx < result.length) {
        result[outIdx++] = (buffer >> bitsCollected) & 0xff;
      }
    }
  }

  return result;
}

/**
 * Decodes URL-safe Base64 string to Uint8Array.
 */
export function base64UrlToBytes(base64url: string): Uint8Array {
  return base64ToBytes(base64url);
}

/**
 * Encodes Uint8Array to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decodes hex string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Constant-time comparison between two byte arrays.
 */
export function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
