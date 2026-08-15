/**
 * Mailbox Capability & Verifier Management for VEIL.
 *
 * Implements capability-based authorization where:
 * - Client holds a high-entropy 256-bit capability secret.
 * - Server stores ONLY a cryptographic verifier: SHA-256(capability || "veil-v1-mailbox-auth").
 * - Server compromise does not reveal mailbox capabilities.
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { randomBytes, bytesToBase64, base64ToBytes, constantTimeEquals } from '../crypto/utils.ts';
import { MailboxCapability } from './types.ts';

export const DOMAIN_MAILBOX_AUTH = new TextEncoder().encode('veil-v1-mailbox-auth');

/**
 * Generates an opaque, high-entropy 32-byte hex mailbox identifier.
 * Unlinked to phone numbers, emails, usernames, or public keys.
 */
export function generateMailboxId(): string {
  const bytes = randomBytes(32);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a full MailboxCapability containing opaque mailboxId and 256-bit secret token.
 */
export function generateMailboxCapability(): MailboxCapability {
  const mailboxId = generateMailboxId();
  const secretBytes = randomBytes(32);
  return {
    mailboxId,
    capability: bytesToBase64(secretBytes),
  };
}

/**
 * Derives a server-side capability verifier from a client capability secret.
 * Verifier = Base64(SHA-256(capabilityBytes || "veil-v1-mailbox-auth"))
 *
 * @param capability Base64 or Uint8Array capability secret
 * @returns Base64 encoded verifier string
 */
export function deriveCapabilityVerifier(capability: string | Uint8Array): string {
  const capBytes = typeof capability === 'string' ? base64ToBytes(capability) : capability;
  if (capBytes.length !== 32) {
    throw new Error(`Invalid capability length: expected 32 bytes, got ${capBytes.length}`);
  }

  const combined = new Uint8Array(capBytes.length + DOMAIN_MAILBOX_AUTH.length);
  combined.set(capBytes, 0);
  combined.set(DOMAIN_MAILBOX_AUTH, capBytes.length);

  const verifierBytes = sha256(combined);
  return bytesToBase64(verifierBytes);
}

/**
 * Verifies a client-provided capability against a server-stored verifier in constant time.
 *
 * @param providedCapability Client's capability secret
 * @param storedVerifier Server's stored verifier string
 * @returns true if capability matches verifier, false otherwise
 */
export function verifyCapability(providedCapability: string | Uint8Array, storedVerifier: string): boolean {
  try {
    const computedVerifier = deriveCapabilityVerifier(providedCapability);
    const computedBytes = base64ToBytes(computedVerifier);
    const storedBytes = base64ToBytes(storedVerifier);

    if (computedBytes.length !== storedBytes.length) {
      return false;
    }

    return constantTimeEquals(computedBytes, storedBytes);
  } catch (_err) {
    return false;
  }
}
