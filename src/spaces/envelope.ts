/**
 * Space Header Envelope Serializer and Validator for VEIL.
 */

import type { SpaceHeaderEnvelope } from '../types/index.ts';
import { base64ToBytes } from '../crypto/utils.ts';
import { XCHACHA20_NONCE_LENGTH, POLY1305_TAG_LENGTH } from '../crypto/aead.ts';

export const CURRENT_ENVELOPE_VERSION = 1;

/**
 * Validates the schema and structure of a SpaceHeaderEnvelope.
 * Throws on corrupted or invalid envelopes.
 */
export function validateSpaceEnvelope(envelope: unknown): asserts envelope is SpaceHeaderEnvelope {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid envelope: payload must be a JSON object');
  }

  const env = envelope as Partial<SpaceHeaderEnvelope>;

  if (typeof env.spaceId !== 'string' || env.spaceId.trim() === '') {
    throw new Error('Invalid envelope: missing or invalid spaceId');
  }

  if (typeof env.version !== 'number') {
    throw new Error('Invalid envelope: missing format version');
  }

  if (env.version !== CURRENT_ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelope version: expected ${CURRENT_ENVELOPE_VERSION}, got ${env.version}`);
  }

  if (typeof env.name !== 'string') {
    throw new Error('Invalid envelope: missing space name');
  }

  if (typeof env.isDecoy !== 'boolean') {
    throw new Error('Invalid envelope: missing isDecoy flag');
  }

  if (!env.kdfParams || typeof env.kdfParams !== 'object') {
    throw new Error('Invalid envelope: missing kdfParams');
  }

  if (env.kdfParams.algorithm !== 'argon2id') {
    throw new Error(`Unsupported KDF algorithm: ${env.kdfParams.algorithm}`);
  }

  if (typeof env.kdfParams.salt !== 'string' || env.kdfParams.salt.length === 0) {
    throw new Error('Invalid envelope: missing KDF salt');
  }

  try {
    const saltBytes = base64ToBytes(env.kdfParams.salt);
    if (saltBytes.length < 16) {
      throw new Error('Invalid envelope: KDF salt too short');
    }
  } catch (_e) {
    throw new Error('Invalid envelope: malformed Base64 KDF salt');
  }

  if (!env.encryptedMasterKey || typeof env.encryptedMasterKey !== 'object') {
    throw new Error('Invalid envelope: missing encryptedMasterKey');
  }

  if (env.encryptedMasterKey.algorithm !== 'XChaCha20-Poly1305' && env.encryptedMasterKey.algorithm !== 'AES-256-GCM') {
    throw new Error(`Unsupported encryption algorithm: ${env.encryptedMasterKey.algorithm}`);
  }

  try {
    const nonceBytes = base64ToBytes(env.encryptedMasterKey.nonce);
    if (nonceBytes.length !== XCHACHA20_NONCE_LENGTH && nonceBytes.length !== 12) {
      throw new Error('Invalid envelope: invalid nonce length');
    }

    const cipherBytes = base64ToBytes(env.encryptedMasterKey.ciphertext);
    // Ciphertext must contain at least 32-byte SMK + 16-byte tag = 48 bytes
    if (cipherBytes.length < 32 + POLY1305_TAG_LENGTH) {
      throw new Error('Invalid envelope: encryptedMasterKey ciphertext too short');
    }
  } catch (_e) {
    throw new Error('Invalid envelope: malformed Base64 encryptedMasterKey');
  }

  if (typeof env.createdAt !== 'number') {
    throw new Error('Invalid envelope: missing createdAt timestamp');
  }
}

/**
 * Serializes a SpaceHeaderEnvelope to formatted JSON string.
 */
export function serializeEnvelope(envelope: SpaceHeaderEnvelope): string {
  validateSpaceEnvelope(envelope);
  return JSON.stringify(envelope);
}

/**
 * Parses and validates a JSON string into a SpaceHeaderEnvelope.
 */
export function parseEnvelope(jsonString: string): SpaceHeaderEnvelope {
  try {
    const parsed = JSON.parse(jsonString);
    validateSpaceEnvelope(parsed);
    return parsed;
  } catch (err: any) {
    throw new Error(`Failed to parse Space envelope: ${err.message}`);
  }
}
