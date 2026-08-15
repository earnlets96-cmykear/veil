/**
 * Canonical Serialization for VEIL Identity Documents.
 *
 * Produces a deterministic byte representation of an identity document
 * suitable for hashing and signing. Does NOT rely on JSON.stringify()
 * key ordering guarantees.
 *
 * The canonical format explicitly orders fields and uses no whitespace.
 */

export interface CanonicalIdentityFields {
  version: number;
  identityId: string;
  signingPublicKey: string;
  keyAgreementPublicKey: string;
  fingerprint: string;
  createdAt: number;
}

/**
 * Produces deterministic canonical bytes for an identity document.
 * Excludes the `signature` field (since the signature is computed over this output).
 *
 * Field order is fixed and explicit:
 *   version, identityId, signingPublicKey, keyAgreementPublicKey, fingerprint, createdAt
 *
 * @param fields The identity document fields to canonicalize
 * @returns Canonical UTF-8 byte representation
 */
export function canonicalizeIdentity(fields: CanonicalIdentityFields): Uint8Array {
  // Fixed field ordering — no reliance on runtime JSON key iteration order
  const canonical = '{"version":' + String(fields.version)
    + ',"identityId":"' + fields.identityId + '"'
    + ',"signingPublicKey":"' + fields.signingPublicKey + '"'
    + ',"keyAgreementPublicKey":"' + fields.keyAgreementPublicKey + '"'
    + ',"fingerprint":"' + fields.fingerprint + '"'
    + ',"createdAt":' + String(fields.createdAt)
    + '}';

  return new TextEncoder().encode(canonical);
}

/**
 * Returns the canonical string (for debugging/display only).
 */
export function canonicalizeIdentityString(fields: CanonicalIdentityFields): string {
  return new TextDecoder().decode(canonicalizeIdentity(fields));
}
