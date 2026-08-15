/**
 * Authenticated Encryption with Associated Data (AEAD) for VEIL.
 * Implements XChaCha20-Poly1305 using @noble/ciphers/chacha.js.
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from './utils.ts';

export const XCHACHA20_NONCE_LENGTH = 24; // 192-bit nonce
export const POLY1305_TAG_LENGTH = 16;   // 128-bit authentication tag

export interface AeadEncryptionResult {
  nonce: Uint8Array;
  ciphertext: Uint8Array; // Contains encrypted data + 16-byte authentication tag
}

/**
 * Encrypts and authenticates a plaintext using XChaCha20-Poly1305.
 *
 * @param key 32-byte symmetric key
 * @param plaintext Plaintext bytes or UTF-8 string
 * @param associatedData Optional authenticated associated data (AAD)
 * @param customNonce Optional specific nonce (used for deterministic tests; random CSPRNG generated otherwise)
 * @returns Nonce and ciphertext (with appended auth tag)
 */
export function encryptXChaCha20Poly1305(
  key: Uint8Array,
  plaintext: Uint8Array | string,
  associatedData?: Uint8Array,
  customNonce?: Uint8Array
): AeadEncryptionResult {
  if (key.length !== 32) {
    throw new Error(`Invalid key length: expected 32 bytes, got ${key.length}`);
  }

  const nonce = customNonce ?? randomBytes(XCHACHA20_NONCE_LENGTH);
  if (nonce.length !== XCHACHA20_NONCE_LENGTH) {
    throw new Error(`Invalid nonce length: expected ${XCHACHA20_NONCE_LENGTH} bytes, got ${nonce.length}`);
  }

  const plaintextBytes = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : plaintext;

  const cipher = xchacha20poly1305(key, nonce, associatedData);
  const ciphertext = cipher.encrypt(plaintextBytes);

  return { nonce, ciphertext };
}

/**
 * Authenticates and decrypts ciphertext using XChaCha20-Poly1305.
 *
 * @param key 32-byte symmetric key
 * @param nonce 24-byte nonce
 * @param ciphertextWithTag Ciphertext bytes containing 16-byte Poly1305 tag
 * @param associatedData Optional authenticated associated data (AAD)
 * @returns Decrypted plaintext bytes
 * @throws Generic error on tag mismatch or corrupted ciphertext
 */
export function decryptXChaCha20Poly1305(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertextWithTag: Uint8Array,
  associatedData?: Uint8Array
): Uint8Array {
  if (key.length !== 32) {
    throw new Error(`Invalid key length: expected 32 bytes, got ${key.length}`);
  }
  if (nonce.length !== XCHACHA20_NONCE_LENGTH) {
    throw new Error(`Invalid nonce length: expected ${XCHACHA20_NONCE_LENGTH} bytes, got ${nonce.length}`);
  }
  if (ciphertextWithTag.length < POLY1305_TAG_LENGTH) {
    throw new Error('Ciphertext too short: missing authentication tag');
  }

  try {
    const cipher = xchacha20poly1305(key, nonce, associatedData);
    return cipher.decrypt(ciphertextWithTag);
  } catch (_err) {
    // Fail safely with generic message to prevent error-based side-channel leaks
    throw new Error('Decryption failed: corrupted ciphertext or authentication tag mismatch');
  }
}
