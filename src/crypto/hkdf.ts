/**
 * Domain-separated Key Expansion (HKDF-SHA256) for VEIL.
 * Uses @noble/hashes/hkdf and @noble/hashes/sha256 (RFC 5869).
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha256.js';

export const DOMAIN_STORAGE = 'veil-v1-storage-key';
export const DOMAIN_IDENTITY = 'veil-v1-identity-seed';
export const DOMAIN_PREKEYS = 'veil-v1-prekey-seed';
export const DOMAIN_MEDIA = 'veil-v1-media-key';

/**
 * Expands a 256-bit Space Master Key into a domain-separated subkey.
 *
 * @param masterKey 32-byte Space Master Key
 * @param domainInfo Specific domain string tag (e.g. 'veil-v1-storage-key')
 * @param length Output key length in bytes (default: 32)
 * @param salt Optional HKDF salt (default: empty salt per RFC 5869)
 * @returns Derived subkey as Uint8Array
 */
export function deriveSubkey(
  masterKey: Uint8Array,
  domainInfo: string,
  length = 32,
  salt?: Uint8Array
): Uint8Array {
  if (masterKey.length !== 32) {
    throw new Error(`Invalid master key length: expected 32 bytes, got ${masterKey.length}`);
  }

  const infoBytes = new TextEncoder().encode(domainInfo);
  return hkdf(sha256, masterKey, salt ?? new Uint8Array(32), infoBytes, length);
}

/**
 * Convenience helper to derive the 256-bit storage encryption key.
 */
export function deriveStorageKey(masterKey: Uint8Array): Uint8Array {
  return deriveSubkey(masterKey, DOMAIN_STORAGE, 32);
}

/**
 * Convenience helper to derive the 256-bit identity generation seed.
 */
export function deriveIdentitySeed(masterKey: Uint8Array): Uint8Array {
  return deriveSubkey(masterKey, DOMAIN_IDENTITY, 32);
}
