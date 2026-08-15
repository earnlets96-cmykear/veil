/**
 * Transport Envelope Packaging & Validation for VEIL.
 *
 * Envelopes wrap opaque encrypted blobs with routing and TTL metadata.
 */

import { TransportEnvelope, SizeClass, SIZE_CLASS_BYTES } from './types.ts';
import { randomBytes, bytesToBase64 } from '../crypto/utils.ts';

export const TRANSPORT_ENVELOPE_VERSION = 1;
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours default TTL

export interface CreateEnvelopeParams {
  mailboxId: string;
  payload: string;           // Base64 encrypted payload
  sizeClass: SizeClass;
  ttlMs?: number;
  customEnvelopeId?: string; // Optional (used for deterministic testing)
}

/**
 * Generates a unique 16-byte random hex envelope ID.
 */
export function generateEnvelopeId(): string {
  const bytes = randomBytes(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Packages an opaque encrypted payload into a versioned TransportEnvelope.
 */
export function createTransportEnvelope(params: CreateEnvelopeParams): TransportEnvelope {
  if (!params.mailboxId || params.mailboxId.trim() === '') {
    throw new Error('Cannot create transport envelope: missing mailboxId');
  }
  if (!params.payload || params.payload.trim() === '') {
    throw new Error('Cannot create transport envelope: missing payload');
  }
  if (!SIZE_CLASS_BYTES[params.sizeClass]) {
    throw new Error(`Cannot create transport envelope: invalid size class "${params.sizeClass}"`);
  }

  const now = Date.now();
  const ttlMs = params.ttlMs ?? DEFAULT_TTL_MS;
  if (ttlMs <= 0) {
    throw new Error('Cannot create transport envelope: TTL must be greater than 0');
  }

  return {
    version: TRANSPORT_ENVELOPE_VERSION,
    envelopeId: params.customEnvelopeId ?? generateEnvelopeId(),
    mailboxId: params.mailboxId,
    payload: params.payload,
    sizeClass: params.sizeClass,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
}

/**
 * Validates a TransportEnvelope for structural integrity and expiration.
 *
 * @param env TransportEnvelope to validate
 * @param now Optional timestamp reference (defaults to Date.now())
 * @returns true if envelope is valid and unexpired
 */
export function validateTransportEnvelope(env: TransportEnvelope, now: number = Date.now()): boolean {
  if (!env) return false;

  // Version check
  if (env.version !== TRANSPORT_ENVELOPE_VERSION) {
    return false;
  }

  // Required field checks
  if (typeof env.envelopeId !== 'string' || env.envelopeId.length === 0) return false;
  if (typeof env.mailboxId !== 'string' || env.mailboxId.length === 0) return false;
  if (typeof env.payload !== 'string' || env.payload.length === 0) return false;
  if (!SIZE_CLASS_BYTES[env.sizeClass]) return false;
  if (typeof env.createdAt !== 'number' || typeof env.expiresAt !== 'number') return false;

  // Expiration check
  if (env.expiresAt <= now) {
    return false;
  }

  return true;
}
