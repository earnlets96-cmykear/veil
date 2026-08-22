/**
 * Public User Profiles & Cryptographic Profile Signing for VEIL.
 *
 * Provides tamper-proof public profile documents bound to the Space's Ed25519 identity,
 * blind relay mailbox, and public prekey bundle.
 */

import { PrekeyBundle } from '../ratchet/types.ts';
import { sign, verify } from './signing.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import { validateUsername } from './username.ts';

export interface PublicProfile {
  identityId: string;
  username: string; // Canonical lowercase username
  displayName: string;
  avatar?: string;
  discoverable: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SignedProfileDocument {
  version: 1;
  identityId: string;
  username: string;
  displayName: string;
  avatar?: string;
  avatarUrl?: string;
  signingPublicKey?: string;
  keyAgreementPublicKey?: string;
  mailboxId: string;
  prekeyBundle: PrekeyBundle;
  issuedAt: number;
  createdAt?: number;
  updatedAt?: number;
  expiresAt?: number;
  signature: string; // Base64 Ed25519 signature
}

export interface CanonicalProfileFields {
  version: 1;
  identityId: string;
  username: string;
  displayName: string;
  avatar?: string;
  mailboxId: string;
  prekeyBundle: PrekeyBundle;
  issuedAt: number;
  expiresAt?: number;
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

/**
 * Deterministically canonicalizes a profile document into UTF-8 bytes for signing and verification.
 * Does not rely on JSON object key iteration order.
 */
export function canonicalizeProfile(fields: CanonicalProfileFields): Uint8Array {
  // Sort and canonicalize the prekeyBundle nested fields
  const pb = fields.prekeyBundle;
  const idDoc = pb.identityDocument;

  const canonicalObj = {
    version: fields.version,
    identityId: fields.identityId,
    username: fields.username,
    displayName: fields.displayName,
    avatar: fields.avatar || '',
    mailboxId: fields.mailboxId,
    prekeyBundle: {
      identityDocument: {
        version: idDoc.version,
        identityId: idDoc.identityId,
        signingPublicKey: idDoc.signingPublicKey,
        keyAgreementPublicKey: idDoc.keyAgreementPublicKey,
        fingerprint: idDoc.fingerprint,
        createdAt: idDoc.createdAt,
      },
      signedPrekey: {
        id: pb.signedPrekey.id,
        publicKey: pb.signedPrekey.publicKey,
        signature: pb.signedPrekey.signature,
        createdAt: pb.signedPrekey.createdAt,
      },
      oneTimePrekey: pb.oneTimePrekey
        ? {
            id: pb.oneTimePrekey.id,
            publicKey: pb.oneTimePrekey.publicKey,
          }
        : null,
    },
    issuedAt: fields.issuedAt,
    expiresAt: fields.expiresAt || 0,
  };

  const canonicalString = JSON.stringify(sortObjectKeys(canonicalObj));
  return new TextEncoder().encode(canonicalString);
}

/**
 * Creates a signed profile document using an Ed25519 private key.
 */
export function createSignedProfile(
  identityId: string,
  signingPrivateKey: Uint8Array,
  username: string,
  displayName: string,
  mailboxId: string,
  prekeyBundle: PrekeyBundle,
  avatar?: string,
  expiresInSeconds?: number
): SignedProfileDocument {
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid || !usernameCheck.canonical) {
    throw new Error(`Invalid username for profile: ${usernameCheck.error}`);
  }

  const now = Date.now();
  const expiresAt = expiresInSeconds ? now + expiresInSeconds * 1000 : undefined;

  const fields: CanonicalProfileFields = {
    version: 1,
    identityId,
    username: usernameCheck.canonical,
    displayName: displayName.trim() || usernameCheck.canonical,
    avatar: avatar?.trim(),
    mailboxId,
    prekeyBundle,
    issuedAt: now,
    expiresAt,
  };

  const canonicalBytes = canonicalizeProfile(fields);
  const signatureBytes = sign(signingPrivateKey, canonicalBytes);
  const signature = bytesToBase64(signatureBytes);

  return {
    ...fields,
    signingPublicKey: prekeyBundle?.identityDocument?.signingPublicKey,
    keyAgreementPublicKey: prekeyBundle?.identityDocument?.keyAgreementPublicKey,
    avatarUrl: avatar?.trim(),
    createdAt: now,
    updatedAt: now,
    signature,
  };
}

/**
 * Verifies the Ed25519 signature of a signed profile document.
 * Returns true if valid, false if tampered with or expired.
 */
export function verifySignedProfile(doc: SignedProfileDocument, expectedPublicKeyBase64?: string): boolean {
  if (!doc || doc.version !== 1) return false;

  // Check expiration
  if (doc.expiresAt && doc.expiresAt < Date.now()) {
    return false;
  }

  // Validate username syntax
  const usernameCheck = validateUsername(doc.username);
  if (!usernameCheck.valid || usernameCheck.canonical !== doc.username) {
    return false;
  }

  const pubKeyBase64 =
    expectedPublicKeyBase64 ||
    doc.prekeyBundle?.identityDocument?.signingPublicKey ||
    doc.signingPublicKey;
  if (!pubKeyBase64) return false;

  try {
    const pubKeyBytes = base64ToBytes(pubKeyBase64);
    const signatureBytes = base64ToBytes(doc.signature);

    const fields: CanonicalProfileFields = {
      version: doc.version,
      identityId: doc.identityId,
      username: doc.username,
      displayName: doc.displayName,
      avatar: doc.avatar,
      mailboxId: doc.mailboxId,
      prekeyBundle: doc.prekeyBundle,
      issuedAt: doc.issuedAt,
      expiresAt: doc.expiresAt,
    };

    const canonicalBytes = canonicalizeProfile(fields);
    return verify(pubKeyBytes, canonicalBytes, signatureBytes);
  } catch (_err) {
    return false;
  }
}
