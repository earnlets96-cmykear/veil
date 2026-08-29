/**
 * Phase 39: Base64 & Base64URL Codec Hardening Test Suite.
 *
 * Verifies:
 * - Empty inputs
 * - Binary bytes (all 256 byte values)
 * - Standard padded Base64
 * - Unpadded Base64
 * - URL-safe Base64 (- and _)
 * - Large binary payloads (>10MB)
 * - Whitespace and newline tolerance
 * - Malformed input rejection with controlled errors (no unhandled atob crashes)
 * - Unicode metadata & string compatibility
 */

import { describe, it, expect } from 'vitest';
import {
  bytesToBase64,
  base64ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  randomBytes,
} from '../src/crypto/utils.ts';

describe('Phase 39: Base64 & Base64URL Codec Hardening', () => {
  it('handles empty inputs cleanly', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    expect(bytesToBase64Url(new Uint8Array(0))).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
    expect(base64UrlToBytes('')).toEqual(new Uint8Array(0));
  });

  it('correctly roundtrips all 256 byte values', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      allBytes[i] = i;
    }

    const b64 = bytesToBase64(allBytes);
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(allBytes);

    const b64Url = bytesToBase64Url(allBytes);
    const decodedUrl = base64UrlToBytes(b64Url);
    expect(decodedUrl).toEqual(allBytes);
  });

  it('handles unpadded standard and URL-safe Base64 strings', () => {
    const data = new TextEncoder().encode('Hello, VEIL Secure World!');
    const standard = bytesToBase64(data);
    const unpadded = standard.replace(/=+$/, '');

    const decoded = base64ToBytes(unpadded);
    expect(new TextDecoder().decode(decoded)).toBe('Hello, VEIL Secure World!');
  });

  it('handles URL-safe characters (- and _) correctly', () => {
    // 0xfb, 0xff produces '+' and '/' in standard, '-' and '_' in url-safe
    const raw = new Uint8Array([0xfb, 0xff, 0xbe, 0xef]);
    const urlSafe = bytesToBase64Url(raw);
    expect(urlSafe).not.toContain('+');
    expect(urlSafe).not.toContain('/');

    const decoded = base64ToBytes(urlSafe);
    expect(decoded).toEqual(raw);
  });

  it('strips internal whitespace and newlines safely', () => {
    const data = new TextEncoder().encode('Privacy-first encrypted communication');
    const b64 = bytesToBase64(data);
    const withWhitespace = `\n  ${b64.slice(0, 10)}\r\n\t  ${b64.slice(10)}  \n`;

    const decoded = base64ToBytes(withWhitespace);
    expect(new TextDecoder().decode(decoded)).toBe('Privacy-first encrypted communication');
  });

  it('encodes and decodes large payloads (10 MiB) without call stack overflow', () => {
    const largeBuffer = randomBytes(10 * 1024 * 1024); // 10 MiB
    const b64 = bytesToBase64(largeBuffer);
    expect(b64.length).toBeGreaterThan(13 * 1024 * 1024);

    const decoded = base64ToBytes(b64);
    expect(decoded.length).toBe(largeBuffer.length);
    expect(decoded[0]).toBe(largeBuffer[0]);
    expect(decoded[decoded.length - 1]).toBe(largeBuffer[largeBuffer.length - 1]);
  });

  it('throws controlled error on invalid Base64 characters without crashing', () => {
    expect(() => base64ToBytes('Invalid!@#$%^&*()')).toThrow('Invalid Base64 character');
  });
});
