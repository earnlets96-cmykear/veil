/**
 * Domain-separated Key Expansion (HKDF-SHA256) for VEIL.
 * Uses @noble/hashes/hkdf and @noble/hashes/sha256 (RFC 5869).
 *
 * Two-tier derivation hierarchy:
 *   SMK → identitySeed (via DOMAIN_IDENTITY_SEED)
 *   identitySeed → signingKeyMaterial (via DOMAIN_SIGNING_KEY)
 *   identitySeed → keyAgreementMaterial (via DOMAIN_KEY_AGREEMENT)
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha256.js';

// Phase 1: Storage
export const DOMAIN_STORAGE = 'veil-v1-storage-key';

// Phase 2: Identity (two-tier derivation)
export const DOMAIN_IDENTITY_SEED = 'veil-v1-identity-seed';
export const DOMAIN_SIGNING_KEY = 'veil-v1-signing-key';
export const DOMAIN_KEY_AGREEMENT = 'veil-v1-key-agreement';

/**
 * Expands a 256-bit key into a domain-separated subkey.
 *
 * @param inputKey 32-byte input keying material
 * @param domainInfo Specific domain string tag
 * @param length Output key length in bytes (default: 32)
 * @param salt Optional HKDF salt (default: empty salt per RFC 5869)
 * @returns Derived subkey as Uint8Array
 */
export function deriveSubkey(
  inputKey: Uint8Array,
  domainInfo: string,
  length = 32,
  salt?: Uint8Array
): Uint8Array {
  if (inputKey.length !== 32) {
    throw new Error(`Invalid key length: expected 32 bytes, got ${inputKey.length}`);
  }

  const infoBytes = new TextEncoder().encode(domainInfo);
  return hkdf(sha256, inputKey, salt ?? new Uint8Array(32), infoBytes, length);
}

/**
 * Convenience: derive the 256-bit storage encryption key from SMK.
 */
export function deriveStorageKey(masterKey: Uint8Array): Uint8Array {
  return deriveSubkey(masterKey, DOMAIN_STORAGE, 32);
}

/**
 * Derive a 256-bit identity seed from the Space Master Key.
 * This is the root of the identity key hierarchy.
 */
export function deriveIdentitySeed(masterKey: Uint8Array): Uint8Array {
  return deriveSubkey(masterKey, DOMAIN_IDENTITY_SEED, 32);
}

/**
 * Derive 32-byte Ed25519 signing key material from the identity seed.
 */
export function deriveSigningKeyMaterial(identitySeed: Uint8Array): Uint8Array {
  return deriveSubkey(identitySeed, DOMAIN_SIGNING_KEY, 32);
}

/**
 * Derive 32-byte X25519 key agreement material from the identity seed.
 */
export function deriveKeyAgreementMaterial(identitySeed: Uint8Array): Uint8Array {
  return deriveSubkey(identitySeed, DOMAIN_KEY_AGREEMENT, 32);
}
