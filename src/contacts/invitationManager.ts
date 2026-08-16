/**
 * Cryptographic Invitation Manager for VEIL.
 *
 * Generates and verifies tamper-evident, signed invitations with Ed25519
 * signatures, replay prevention, and expiration controls.
 */

import { InvitationPayload } from './types.ts';
import { IdentityDocument } from '../identity/document.ts';
import { sign as edSign, verify as edVerify } from '../identity/signing.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import { PrekeyBundle } from '../ratchet/types.ts';

const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

export class InvitationManager {
  /**
   * Generates a signed invitation string.
   */
  public static createInvitation(
    identityDoc: IdentityDocument,
    signingPrivateKey: Uint8Array,
    name: string,
    expiresInMs = DEFAULT_INVITATION_TTL_MS,
    mailboxId?: string,
    prekeyBundle?: PrekeyBundle
  ): InvitationPayload {
    const now = Date.now();
    const expiresAt = now + expiresInMs;

    const unsignedPayload: any = {
      version: 1 as const,
      identityId: identityDoc.identityId,
      name,
      signingPublicKey: identityDoc.signingPublicKey,
      keyAgreementPublicKey: identityDoc.keyAgreementPublicKey,
      fingerprint: identityDoc.fingerprint,
      createdAt: now,
      expiresAt,
    };

    if (mailboxId) {
      unsignedPayload.mailboxId = mailboxId;
    }
    if (prekeyBundle) {
      unsignedPayload.prekeyBundle = prekeyBundle;
    }

    const canonicalBytes = new TextEncoder().encode(JSON.stringify(unsignedPayload));
    const signatureBytes = edSign(signingPrivateKey, canonicalBytes);
    const signature = bytesToBase64(signatureBytes);

    return {
      ...unsignedPayload,
      signature,
    };
  }

  /**
   * Encodes an invitation to a shareable string prefix format: `veil://invite/<base64>`.
   */
  public static toShareableString(invitation: InvitationPayload): string {
    const jsonStr = JSON.stringify(invitation);
    const b64 = bytesToBase64(new TextEncoder().encode(jsonStr));
    return `veil://invite/${b64}`;
  }

  /**
   * Parses and cryptographically verifies an incoming invitation string.
   */
  public static verifyAndParseInvitation(rawStr: string): InvitationPayload {
    let jsonStr = rawStr.trim();
    if (jsonStr.startsWith('veil://invite/')) {
      const b64 = jsonStr.replace('veil://invite/', '');
      jsonStr = new TextDecoder().decode(base64ToBytes(b64));
    }

    let payload: any;
    try {
      payload = JSON.parse(jsonStr);
    } catch (_e) {
      throw new Error('Invalid invitation format: not valid JSON or Base64 payload');
    }

    if (
      !payload ||
      payload.version !== 1 ||
      !payload.identityId ||
      !payload.signingPublicKey ||
      !payload.keyAgreementPublicKey ||
      !payload.signature ||
      !payload.expiresAt
    ) {
      throw new Error('Malformed invitation: missing required cryptographic fields');
    }

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      throw new Error('Invitation has expired');
    }

    // Verify Ed25519 signature
    const unsignedObj: any = {
      version: payload.version,
      identityId: payload.identityId,
      name: payload.name,
      signingPublicKey: payload.signingPublicKey,
      keyAgreementPublicKey: payload.keyAgreementPublicKey,
      fingerprint: payload.fingerprint,
      createdAt: payload.createdAt,
      expiresAt: payload.expiresAt,
    };

    if (payload.mailboxId !== undefined) {
      unsignedObj.mailboxId = payload.mailboxId;
    }
    if (payload.prekeyBundle !== undefined) {
      unsignedObj.prekeyBundle = payload.prekeyBundle;
    }

    const canonicalBytes = new TextEncoder().encode(JSON.stringify(unsignedObj));
    const signPubKeyBytes = base64ToBytes(payload.signingPublicKey);
    const sigBytes = base64ToBytes(payload.signature);

    const isValid = edVerify(signPubKeyBytes, canonicalBytes, sigBytes);
    if (!isValid) {
      throw new Error('Invalid invitation signature: potential forgery or tampering detected');
    }

    return payload as InvitationPayload;
  }
}
