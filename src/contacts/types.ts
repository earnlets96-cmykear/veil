/**
 * Contact and Invitation Types for VEIL.
 */

import { PrekeyBundle } from '../ratchet/types.ts';

export type ContactStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'MISMATCH';

export interface Contact {
  identityId: string;
  name: string;
  fingerprint: string;
  signingPublicKey: string; // Base64
  keyAgreementPublicKey: string; // Base64
  status: ContactStatus;
  verificationStatus: VerificationStatus;
  addedAt: number;
  lastSeen?: number;
  prekeyBundle?: PrekeyBundle;
  metadata?: Record<string, string>;
}

export interface InvitationPayload {
  version: 1;
  identityId: string;
  name: string;
  signingPublicKey: string; // Base64
  keyAgreementPublicKey: string; // Base64
  fingerprint: string;
  prekeyBundle?: PrekeyBundle;
  createdAt: number;
  expiresAt: number;
  signature: string; // Ed25519 signature over canonical payload string
}
