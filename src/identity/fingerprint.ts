/**
 * Identity Fingerprint Computation for VEIL.
 *
 * Produces a human-verifiable fingerprint from public identity material.
 * Format: 12 groups of 5 digits (60 digits total).
 *
 * Construction: SHA-256(signingPublicKey || keyAgreementPublicKey)
 *   → 32 bytes → numeric fingerprint
 */

import { sha256 } from '@noble/hashes/sha256.js';

/**
 * Computes a fingerprint from the concatenation of signing and key agreement public keys.
 *
 * @param signingPub 32-byte Ed25519 public key
 * @param keyAgreementPub 32-byte X25519 public key
 * @returns Formatted fingerprint string (60 digits in 12 groups of 5)
 */
export function computeFingerprint(signingPub: Uint8Array, keyAgreementPub: Uint8Array): string {
  if (signingPub.length !== 32) {
    throw new Error(`Invalid signing public key length: expected 32 bytes, got ${signingPub.length}`);
  }
  if (keyAgreementPub.length !== 32) {
    throw new Error(`Invalid key agreement public key length: expected 32 bytes, got ${keyAgreementPub.length}`);
  }

  // Concatenate: signingPub || keyAgreementPub
  const combined = new Uint8Array(64);
  combined.set(signingPub, 0);
  combined.set(keyAgreementPub, 32);

  const hash = sha256(combined);
  return formatFingerprint(hash);
}

/**
 * Formats a 32-byte hash into a human-readable fingerprint.
 * Produces 12 groups of 5 digits (60 digits total).
 *
 * Each group is derived from adjacent bytes interpreted as a big-endian
 * number modulo 100000 (5 digits).
 *
 * @param hash 32-byte SHA-256 hash
 * @returns Formatted fingerprint string
 */
export function formatFingerprint(hash: Uint8Array): string {
  if (hash.length < 32) {
    throw new Error(`Hash too short: expected at least 32 bytes, got ${hash.length}`);
  }

  const groups: string[] = [];

  // We need 12 groups from 32 bytes.
  // Use pairs of bytes (16 bits) plus overflow bits from adjacent bytes
  // to extract enough entropy for 5-digit groups.
  // Strategy: interpret every 2.666 bytes as a group.
  // Simpler: use DataView to read overlapping uint16 values and extend with next byte.
  for (let i = 0; i < 12; i++) {
    // Read 2 bytes + partial from the 32-byte hash, wrapping as needed
    const b0 = hash[i * 2 % 32];
    const b1 = hash[(i * 2 + 1) % 32];
    const b2 = hash[(i * 2 + 2) % 32];

    // Combine into a 24-bit number and take mod 100000 for 5 digits
    const value = (b0 << 16) | (b1 << 8) | b2;
    groups.push(String(value % 100000).padStart(5, '0'));
  }

  return groups.join(' ');
}

/**
 * Computes the identity ID from public key material.
 * Returns hex(SHA-256(signingPub || keyAgreementPub)).
 *
 * @param signingPub 32-byte Ed25519 public key
 * @param keyAgreementPub 32-byte X25519 public key
 * @returns Hex-encoded identity ID string
 */
export function computeIdentityId(signingPub: Uint8Array, keyAgreementPub: Uint8Array): string {
  if (signingPub.length !== 32) {
    throw new Error(`Invalid signing public key length: expected 32 bytes, got ${signingPub.length}`);
  }
  if (keyAgreementPub.length !== 32) {
    throw new Error(`Invalid key agreement public key length: expected 32 bytes, got ${keyAgreementPub.length}`);
  }

  const combined = new Uint8Array(64);
  combined.set(signingPub, 0);
  combined.set(keyAgreementPub, 32);

  const hash = sha256(combined);
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}
