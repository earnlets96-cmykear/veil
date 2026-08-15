/**
 * X25519 Key Agreement Identity for VEIL.
 * Wraps @noble/curves/ed25519 (v1.8.0, exports x25519 — RFC 7748).
 *
 * Purpose: Establishes shared cryptographic secrets between two Spaces
 * for future encrypted messaging (Phase 4+).
 */

import { x25519 } from '@noble/curves/ed25519.js';

export interface KeyAgreementKeypair {
  privateKey: Uint8Array; // 32 bytes
  publicKey: Uint8Array;  // 32 bytes
}

/**
 * Generates an X25519 key agreement keypair from a 32-byte seed.
 * The seed is used directly as the private key (X25519 applies clamping internally).
 *
 * @param seed 32-byte HKDF-derived key agreement material
 * @returns X25519 keypair
 */
export function generateKeyAgreementKeypair(seed: Uint8Array): KeyAgreementKeypair {
  if (seed.length !== 32) {
    throw new Error(`Invalid seed length: expected 32 bytes, got ${seed.length}`);
  }

  const privateKey = new Uint8Array(seed);
  const publicKey = x25519.getPublicKey(privateKey);

  return { privateKey, publicKey };
}

/**
 * Derives a shared secret using X25519 Diffie-Hellman.
 *
 * @param privateKey 32-byte X25519 private key
 * @param peerPublicKey 32-byte X25519 public key of the peer
 * @returns 32-byte shared secret
 */
export function deriveSharedSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
  if (privateKey.length !== 32) {
    throw new Error(`Invalid private key length: expected 32 bytes, got ${privateKey.length}`);
  }
  if (peerPublicKey.length !== 32) {
    throw new Error(`Invalid peer public key length: expected 32 bytes, got ${peerPublicKey.length}`);
  }

  return x25519.getSharedSecret(privateKey, peerPublicKey);
}
