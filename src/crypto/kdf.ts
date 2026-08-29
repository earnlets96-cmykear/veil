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

/**
 * Async version of deriveKeyArgon2id that runs Argon2id in a Web Worker
 * to avoid blocking the UI thread. Falls back to synchronous derivation
 * if Workers are unavailable (e.g. in tests or non-browser environments).
 */
export async function deriveKeyArgon2idAsync(
  password: string | Uint8Array,
  salt: Uint8Array | string,
  params?: Partial<KdfParameters>
): Promise<Uint8Array> {
  // Fallback to synchronous in non-browser environments
  if (typeof Worker === 'undefined') {
    return deriveKeyArgon2id(password, salt, params);
  }

  const saltStr = typeof salt === 'string'
    ? salt
    : btoa(String.fromCharCode(...salt));

  const pwdStr = typeof password === 'string'
    ? password
    : new TextDecoder().decode(password);

  const timeCost = params?.timeCost ?? DEFAULT_KDF_PARAMS.timeCost;
  const memoryCost = params?.memoryCost ?? DEFAULT_KDF_PARAMS.memoryCost;
  const parallelism = params?.parallelism ?? DEFAULT_KDF_PARAMS.parallelism;
  const keyLength = params?.keyLength ?? DEFAULT_KDF_PARAMS.keyLength;

  try {
    const worker = new Worker(
      new URL('./kdfWorker.ts', import.meta.url),
      { type: 'module' }
    );

    const requestId = `kdf_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        // Fallback to synchronous on timeout
        try {
          resolve(deriveKeyArgon2id(password, salt, params));
        } catch (e) {
          reject(e);
        }
      }, 30000); // 30s timeout

      worker.onmessage = (event: MessageEvent) => {
        clearTimeout(timeout);
        worker.terminate();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(new Uint8Array(event.data.derivedKey));
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        // Fallback to synchronous on worker error
        try {
          resolve(deriveKeyArgon2id(password, salt, params));
        } catch (e) {
          reject(e);
        }
      };

      worker.postMessage({
        requestId,
        password: pwdStr,
        salt: saltStr,
        params: { timeCost, memoryCost, parallelism, keyLength },
      });
    });
  } catch (_err) {
    // Worker creation failed — fall back to synchronous
    return deriveKeyArgon2id(password, salt, params);
  }
}
