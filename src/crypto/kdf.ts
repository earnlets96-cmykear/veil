/**
 * Password Key Derivation Function (Argon2id) for VEIL.
 * Uses the audited @noble/hashes/argon2 library (RFC 9106).
 */

import { argon2id } from '@noble/hashes/argon2.js';
import { base64ToBytes } from './utils.ts';
import type { KdfParameters } from '../types/index.ts';

/**
 * Standard production Argon2id parameters.
 * Memory: 64 MiB (65536 KiB), Time: 3 iterations, Parallelism: 1 thread.
 */
export const DEFAULT_KDF_PARAMS: KdfParameters = {
  algorithm: 'argon2id',
  salt: '', // Populated per Space
  timeCost: 3,
  memoryCost: 65536,
  parallelism: 1,
  keyLength: 32,
};

/**
 * Fast KDF parameters for test suites requiring high-iteration space tests.
 */
export const FAST_TEST_KDF_PARAMS: Omit<KdfParameters, 'salt'> = {
  algorithm: 'argon2id',
  timeCost: 1,
  memoryCost: 1024, // 1 MiB
  parallelism: 1,
  keyLength: 32,
};

/**
 * Derives a 256-bit Key Encryption Key (KEK) from a password and salt using Argon2id.
 *
 * @param password The user password string or byte array
 * @param salt 32-byte salt (Uint8Array or Base64 string)
 * @param params Optional custom KDF parameters
 * @returns 32-byte derived KEK as Uint8Array
 */
export function deriveKeyArgon2id(
  password: string | Uint8Array,
  salt: Uint8Array | string,
  params?: Partial<KdfParameters>
): Uint8Array {
  const pwdBytes = typeof password === 'string' 
    ? new TextEncoder().encode(password) 
    : password;
    
  const saltBytes = typeof salt === 'string' 
    ? base64ToBytes(salt) 
    : salt;

  if (saltBytes.length < 16) {
    throw new Error('Salt must be at least 16 bytes');
  }

  const timeCost = params?.timeCost ?? DEFAULT_KDF_PARAMS.timeCost;
  const memoryCost = params?.memoryCost ?? DEFAULT_KDF_PARAMS.memoryCost;
  const parallelism = params?.parallelism ?? DEFAULT_KDF_PARAMS.parallelism;
  const keyLength = params?.keyLength ?? DEFAULT_KDF_PARAMS.keyLength;

  return argon2id(pwdBytes, saltBytes, {
    t: timeCost,
    m: memoryCost,
    p: parallelism,
    dkLen: keyLength,
  });
}
