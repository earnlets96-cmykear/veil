/**
 * Ed25519 Digital Signature Identity for VEIL.
 * Wraps @noble/curves/ed25519 (v1.8.0, RFC 8032).
 *
 * Purpose: Proves "this data was authorized by this Space."
 * Each Space has an independent signing identity.
 */

import { ed25519 } from '@noble/curves/ed25519.js';

export interface SigningKeypair {
  privateKey: Uint8Array; // 32 bytes
  publicKey: Uint8Array;  // 32 bytes
}

/**
 * Generates an Ed25519 signing keypair from a 32-byte seed.
 * The seed is used directly as the private key.
 *
 * @param seed 32-byte HKDF-derived signing key material
 * @returns Ed25519 keypair
 */
export function generateSigningKeypair(seed: Uint8Array): SigningKeypair {
  if (seed.length !== 32) {
    throw new Error(`Invalid seed length: expected 32 bytes, got ${seed.length}`);
  }

  const privateKey = new Uint8Array(seed);
  const publicKey = ed25519.getPublicKey(privateKey);

  return { privateKey, publicKey };
}

/**
 * Signs a message with an Ed25519 private key.
 *
 * @param privateKey 32-byte Ed25519 private key
 * @param message Message bytes to sign
 * @returns 64-byte Ed25519 signature
 */
export function sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  if (privateKey.length !== 32) {
    throw new Error(`Invalid private key length: expected 32 bytes, got ${privateKey.length}`);
  }

  return ed25519.sign(message, privateKey);
}

/**
 * Verifies an Ed25519 signature.
 *
 * @param publicKey 32-byte Ed25519 public key
 * @param message Original message bytes
 * @param signature 64-byte Ed25519 signature
 * @returns true if the signature is valid, false otherwise
 */
export function verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: expected 32 bytes, got ${publicKey.length}`);
  }
  if (signature.length !== 64) {
    throw new Error(`Invalid signature length: expected 64 bytes, got ${signature.length}`);
  }

  try {
    return ed25519.verify(signature, message, publicKey);
  } catch (_err) {
    return false;
  }
}
