/**
 * Self-Signed Identity Document for VEIL.
 *
 * An IdentityDocument contains public identity material for a Space,
 * cryptographically bound together via an Ed25519 self-signature.
 *
 * The signature is computed over the canonical serialization of all
 * fields EXCEPT the signature itself.
 */

import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import { sign, verify } from './signing.ts';
import { canonicalizeIdentity } from './canonical.ts';
import { computeFingerprint, computeIdentityId } from './fingerprint.ts';

export const IDENTITY_DOCUMENT_VERSION = 1;

export interface IdentityDocument {
  version: 1;
  identityId: string;              // hex(SHA-256(signingPub || kaPub))
  signingPublicKey: string;         // Base64
  keyAgreementPublicKey: string;    // Base64
  fingerprint: string;             // 60-digit formatted fingerprint
  createdAt: number;
  signature: string;               // Base64 Ed25519 self-signature
}

/**
 * Creates a self-signed identity document.
 *
 * @param signingPrivateKey 32-byte Ed25519 private key (used to sign)
 * @param signingPublicKey 32-byte Ed25519 public key
 * @param keyAgreementPublicKey 32-byte X25519 public key
 * @param createdAt Unix timestamp
 * @returns Self-signed IdentityDocument
 */
export function createIdentityDocument(
  signingPrivateKey: Uint8Array,
  signingPublicKey: Uint8Array,
  keyAgreementPublicKey: Uint8Array,
  createdAt: number
): IdentityDocument {
  if (signingPrivateKey.length !== 32) {
    throw new Error(`Invalid signing private key length: expected 32 bytes, got ${signingPrivateKey.length}`);
  }
  if (signingPublicKey.length !== 32) {
    throw new Error(`Invalid signing public key length: expected 32 bytes, got ${signingPublicKey.length}`);
  }
  if (keyAgreementPublicKey.length !== 32) {
    throw new Error(`Invalid key agreement public key length: expected 32 bytes, got ${keyAgreementPublicKey.length}`);
  }

  const identityId = computeIdentityId(signingPublicKey, keyAgreementPublicKey);
  const fingerprint = computeFingerprint(signingPublicKey, keyAgreementPublicKey);

  const signingPubB64 = bytesToBase64(signingPublicKey);
  const kaPubB64 = bytesToBase64(keyAgreementPublicKey);

  // Compute canonical representation (excludes signature)
  const canonicalBytes = canonicalizeIdentity({
    version: IDENTITY_DOCUMENT_VERSION,
    identityId,
    signingPublicKey: signingPubB64,
    keyAgreementPublicKey: kaPubB64,
    fingerprint,
    createdAt,
  });

  // Self-sign with the Ed25519 signing key
  const signatureBytes = sign(signingPrivateKey, canonicalBytes);

  return {
    version: IDENTITY_DOCUMENT_VERSION,
    identityId,
    signingPublicKey: signingPubB64,
    keyAgreementPublicKey: kaPubB64,
    fingerprint,
    createdAt,
    signature: bytesToBase64(signatureBytes),
  };
}

/**
 * Verifies a self-signed identity document.
 *
 * 1. Rejects unknown versions.
 * 2. Recomputes the canonical representation.
 * 3. Verifies the Ed25519 self-signature.
 * 4. Verifies that identityId and fingerprint match the public keys.
 *
 * @param doc The identity document to verify
 * @returns true if the document is authentic, false otherwise
 */
export function verifyIdentityDocument(doc: IdentityDocument): boolean {
  // Version check
  if (doc.version !== IDENTITY_DOCUMENT_VERSION) {
    return false;
  }

  // Required field presence
  if (!doc.identityId || !doc.signingPublicKey || !doc.keyAgreementPublicKey ||
      !doc.fingerprint || !doc.signature || typeof doc.createdAt !== 'number') {
    return false;
  }

  try {
    const signingPub = base64ToBytes(doc.signingPublicKey);
    const kaPub = base64ToBytes(doc.keyAgreementPublicKey);
    const signatureBytes = base64ToBytes(doc.signature);

    if (signingPub.length !== 32 || kaPub.length !== 32 || signatureBytes.length !== 64) {
      return false;
    }

    // Verify identityId matches public keys
    const expectedId = computeIdentityId(signingPub, kaPub);
    if (doc.identityId !== expectedId) {
      return false;
    }

    // Verify fingerprint matches public keys
    const expectedFingerprint = computeFingerprint(signingPub, kaPub);
    if (doc.fingerprint !== expectedFingerprint) {
      return false;
    }

    // Recompute canonical bytes and verify signature
    const canonicalBytes = canonicalizeIdentity({
      version: doc.version,
      identityId: doc.identityId,
      signingPublicKey: doc.signingPublicKey,
      keyAgreementPublicKey: doc.keyAgreementPublicKey,
      fingerprint: doc.fingerprint,
      createdAt: doc.createdAt,
    });

    return verify(signingPub, canonicalBytes, signatureBytes);
  } catch (_err) {
    return false;
  }
}
