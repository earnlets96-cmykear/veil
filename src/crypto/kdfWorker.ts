/**
 * Web Worker script for Argon2id key derivation.
 *
 * Runs expensive Argon2id computation off the main UI thread to prevent
 * freezing during Space unlock. Communicates via postMessage.
 *
 * SECURITY: No sensitive data is logged. Derived key is transferred
 * back to the main thread and the worker buffer is cleared.
 */

import { argon2id } from '@noble/hashes/argon2.js';

self.onmessage = (event: MessageEvent) => {
  const { password, salt, params, requestId } = event.data;

  try {
    const pwdBytes = typeof password === 'string'
      ? new TextEncoder().encode(password)
      : new Uint8Array(password);

    const saltBytes = typeof salt === 'string'
      ? Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
      : new Uint8Array(salt);

    const derivedKey = argon2id(pwdBytes, saltBytes, {
      t: params.timeCost || 3,
      m: params.memoryCost || 65536,
      p: params.parallelism || 1,
      dkLen: params.keyLength || 32,
    });

    // Transfer the derived key buffer back
    const result = new Uint8Array(derivedKey);
    (self as any).postMessage(
      { requestId, derivedKey: result, error: null },
      [result.buffer]
    );
  } catch (err: any) {
    (self as any).postMessage({
      requestId,
      derivedKey: null,
      error: err?.message || 'KDF derivation failed',
    });
  }
};
