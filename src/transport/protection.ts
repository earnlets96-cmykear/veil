/**
 * PHASE 3 TRANSPORT PROTECTION (TEMPORARY — NOT FINAL E2EE).
 *
 * NOTE: This module provides authenticated symmetric encryption for Phase 3
 * transport verification tests. It ensures payloads are opaque to the server.
 *
 * Final end-to-end message encryption with Double Ratchet and prekey bundles
 * belongs strictly to Phase 4.
 */

import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { padPayload, unpadPayload } from './padding.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import { SizeClass } from './types.ts';

export interface ProtectedTransportPayload {
  nonce: string;         // Base64 24-byte nonce
  ciphertext: string;    // Base64 encrypted padded payload + auth tag
  sizeClass: SizeClass;
}

/**
 * Encrypts and pads a plaintext payload for transport simulation.
 *
 * @param transportKey 32-byte symmetric transport key
 * @param plaintext Plaintext message bytes
 * @param associatedData Optional AAD for context binding
 * @returns Nonce, ciphertext, and sizeClass
 */
export function protectPayloadForTransport(
  transportKey: Uint8Array,
  plaintext: Uint8Array | string,
  associatedData?: Uint8Array
): ProtectedTransportPayload {
  const plaintextBytes = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : plaintext;

  // 1. Apply deterministic size-class padding
  const { padded, sizeClass } = padPayload(plaintextBytes);

  // 2. Encrypt padded payload using XChaCha20-Poly1305
  const { nonce, ciphertext } = encryptXChaCha20Poly1305(transportKey, padded, associatedData);

  return {
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    sizeClass,
  };
}

/**
 * Decrypts and unpads a transport payload.
 *
 * @param transportKey 32-byte symmetric transport key
 * @param nonce Base64 24-byte nonce
 * @param ciphertext Base64 ciphertext with auth tag
 * @param associatedData Optional AAD
 * @returns Original plaintext bytes
 */
export function unprotectTransportPayload(
  transportKey: Uint8Array,
  nonce: string,
  ciphertext: string,
  associatedData?: Uint8Array
): Uint8Array {
  const nonceBytes = base64ToBytes(nonce);
  const ciphertextBytes = base64ToBytes(ciphertext);

  // 1. Authenticate and decrypt
  const decryptedPadded = decryptXChaCha20Poly1305(transportKey, nonceBytes, ciphertextBytes, associatedData);

  // 2. Remove and validate size-class padding
  return unpadPayload(decryptedPadded);
}
