/**
 * Double Ratchet Key Derivation Functions (KDFs) for VEIL.
 *
 * Implements standard KDF-RK (Root Key KDF via HKDF-SHA256) and
 * KDF-CK (Chain Key KDF via HMAC-SHA256) per the Signal Double Ratchet specification.
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha256.js';
import { RatchetMessageHeader } from './types.ts';

export const DOMAIN_RATCHET_ROOT = new TextEncoder().encode('veil-v1-ratchet-root');
export const CONSTANT_MSG_KEY = new TextEncoder().encode('veil-v1-msg-key-constant');
export const CONSTANT_CHAIN_STEP = new TextEncoder().encode('veil-v1-chain-step-constant');

export interface KdfRkResult {
  newRootKey: Uint8Array;  // 32 bytes
  newChainKey: Uint8Array; // 32 bytes
}

export interface KdfCkResult {
  nextChainKey: Uint8Array; // 32 bytes
  messageKey: Uint8Array;   // 32 bytes
}

/**
 * KDF-RK: Advances the Root Key ratchet using a fresh DH shared secret.
 *
 * (newRootKey, newChainKey) = HKDF(salt=rootKey, ikm=dhSharedSecret, info="veil-v1-ratchet-root", length=64)
 *
 * @param rootKey Current 32-byte Root Key
 * @param dhSharedSecret Fresh 32-byte X25519 DH shared secret
 * @returns newRootKey (32 bytes) and newChainKey (32 bytes)
 */
export function kdfRK(rootKey: Uint8Array, dhSharedSecret: Uint8Array): KdfRkResult {
  if (rootKey.length !== 32) {
    throw new Error(`Invalid root key length: expected 32 bytes, got ${rootKey.length}`);
  }
  if (dhSharedSecret.length !== 32) {
    throw new Error(`Invalid DH shared secret length: expected 32 bytes, got ${dhSharedSecret.length}`);
  }

  // Derive 64 bytes via HKDF-SHA256
  const output = hkdf(sha256, dhSharedSecret, rootKey, DOMAIN_RATCHET_ROOT, 64);

  const newRootKey = output.slice(0, 32);
  const newChainKey = output.slice(32, 64);

  return { newRootKey, newChainKey };
}

/**
 * KDF-CK: Derives a single-use message key and steps the symmetric chain key forward.
 *
 * messageKey = HMAC-SHA256(chainKey, CONSTANT_MSG_KEY)
 * nextChainKey = HMAC-SHA256(chainKey, CONSTANT_CHAIN_STEP)
 *
 * @param chainKey Current 32-byte Chain Key
 * @returns nextChainKey (32 bytes) and messageKey (32 bytes)
 */
export function kdfCK(chainKey: Uint8Array): KdfCkResult {
  if (chainKey.length !== 32) {
    throw new Error(`Invalid chain key length: expected 32 bytes, got ${chainKey.length}`);
  }

  const messageKey = hmac(sha256, chainKey, CONSTANT_MSG_KEY);
  const nextChainKey = hmac(sha256, chainKey, CONSTANT_CHAIN_STEP);

  return { nextChainKey, messageKey };
}

/**
 * Canonicalizes a RatchetMessageHeader to deterministic bytes for AEAD Authenticated Associated Data (AAD).
 * Prevents header modification or session transplantation.
 */
export function canonicalizeRatchetHeader(header: RatchetMessageHeader): Uint8Array {
  let canonical = `{"version":${header.version},"dhRatchetPub":"${header.dhRatchetPub}","sequenceNum":${header.sequenceNum},"prevChainLength":${header.prevChainLength}`;

  if (header.x3dhHeader) {
    canonical += `,"x3dh":{"ephemeralPublicKey":"${header.x3dhHeader.ephemeralPublicKey}","signedPrekeyId":${header.x3dhHeader.signedPrekeyId}`;
    if (header.x3dhHeader.oneTimePrekeyId !== undefined) {
      canonical += `,"oneTimePrekeyId":${header.x3dhHeader.oneTimePrekeyId}`;
    }
    canonical += `}`;
  }

  canonical += `}`;
  return new TextEncoder().encode(canonical);
}
