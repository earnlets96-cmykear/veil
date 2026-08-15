/**
 * Extended Triple Diffie-Hellman (X3DH) Protocol Implementation for VEIL.
 *
 * Provides mutually authenticated, forward-secure initial key agreement
 * between two Spaces, even when the recipient is offline.
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha256.js';
import { deriveSharedSecret } from '../identity/keyAgreement.ts';
import { generateKeyAgreementKeypair, KeyAgreementKeypair } from '../identity/keyAgreement.ts';
import { PrekeyBundle, X3DHInitiationHeader } from './types.ts';
import { PrekeyManager } from './prekeys.ts';
import { base64ToBytes, bytesToBase64, randomBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';

export const DOMAIN_X3DH_MASTER = new TextEncoder().encode('veil-v1-x3dh-master');

export interface X3DHInitiatorResult {
  sharedMasterKey: Uint8Array; // 32-byte initial root secret
  header: X3DHInitiationHeader;
  ephemeralKeypair: KeyAgreementKeypair;
}

/**
 * Initiator (Alice) runs X3DH to establish a shared master secret with Bob using Bob's prekey bundle.
 *
 * @param aliceIdentityPriv 32-byte X25519 private key of Alice
 * @param bobBundle Bob's public PrekeyBundle
 * @returns 32-byte shared master secret and X3DH initiation header
 */
export function initiateX3DH(
  aliceIdentityPriv: Uint8Array,
  bobBundle: PrekeyBundle
): X3DHInitiatorResult {
  // 1. Verify Bob's Signed Prekey signature
  const bobSigningPub = base64ToBytes(bobBundle.identityDocument.signingPublicKey);
  const spkValid = PrekeyManager.verifySignedPrekey(bobSigningPub, bobBundle.signedPrekey);
  if (!spkValid) {
    throw new Error('X3DH failed: Bob Signed Prekey signature verification failed (MITM detected)');
  }

  // 2. Generate Alice's ephemeral keypair (EK_A)
  const ephemeralKeypair = generateKeyAgreementKeypair(randomBytes(32));

  // 3. Extract Bob's public keys
  const bobIdentityPub = base64ToBytes(bobBundle.identityDocument.keyAgreementPublicKey);
  const bobSpkPub = base64ToBytes(bobBundle.signedPrekey.publicKey);

  let dh1: Uint8Array | null = null;
  let dh2: Uint8Array | null = null;
  let dh3: Uint8Array | null = null;
  let dh4: Uint8Array | null = null;

  try {
    // DH1 = DH(IK_A, SPK_B)
    dh1 = deriveSharedSecret(aliceIdentityPriv, bobSpkPub);

    // DH2 = DH(EK_A, IK_B)
    dh2 = deriveSharedSecret(ephemeralKeypair.privateKey, bobIdentityPub);

    // DH3 = DH(EK_A, SPK_B)
    dh3 = deriveSharedSecret(ephemeralKeypair.privateKey, bobSpkPub);

    let ikm: Uint8Array;

    if (bobBundle.oneTimePrekey) {
      // DH4 = DH(EK_A, OPK_B)
      const bobOpkPub = base64ToBytes(bobBundle.oneTimePrekey.publicKey);
      dh4 = deriveSharedSecret(ephemeralKeypair.privateKey, bobOpkPub);

      // IKM = DH1 || DH2 || DH3 || DH4 (128 bytes)
      ikm = new Uint8Array(128);
      ikm.set(dh1, 0);
      ikm.set(dh2, 32);
      ikm.set(dh3, 64);
      ikm.set(dh4, 96);
    } else {
      // IKM = DH1 || DH2 || DH3 (96 bytes)
      ikm = new Uint8Array(96);
      ikm.set(dh1, 0);
      ikm.set(dh2, 32);
      ikm.set(dh3, 64);
    }

    // Derive 32-byte master key via HKDF-SHA256
    const sharedMasterKey = hkdf(sha256, ikm, new Uint8Array(32), DOMAIN_X3DH_MASTER, 32);
    zeroize(ikm);

    const header: X3DHInitiationHeader = {
      ephemeralPublicKey: bytesToBase64(ephemeralKeypair.publicKey),
      signedPrekeyId: bobBundle.signedPrekey.id,
      oneTimePrekeyId: bobBundle.oneTimePrekey?.id,
    };

    return { sharedMasterKey, header, ephemeralKeypair };
  } finally {
    if (dh1) zeroize(dh1);
    if (dh2) zeroize(dh2);
    if (dh3) zeroize(dh3);
    if (dh4) zeroize(dh4);
  }
}

/**
 * Receiver (Bob) runs X3DH using Alice's public keys and his own prekeys to compute the identical shared master key.
 *
 * @param bobIdentityPriv Bob's X25519 private identity key
 * @param bobSpkPriv Bob's X25519 private signed prekey
 * @param bobOpkPriv Bob's X25519 private one-time prekey (or null if none used)
 * @param aliceIdentityPub Alice's X25519 public identity key
 * @param header X3DHInitiationHeader from Alice's message
 * @returns 32-byte matching shared master secret
 */
export function receiveX3DH(
  bobIdentityPriv: Uint8Array,
  bobSpkPriv: Uint8Array,
  bobOpkPriv: Uint8Array | null,
  aliceIdentityPub: Uint8Array,
  header: X3DHInitiationHeader
): Uint8Array {
  const aliceEphemeralPub = base64ToBytes(header.ephemeralPublicKey);

  let dh1: Uint8Array | null = null;
  let dh2: Uint8Array | null = null;
  let dh3: Uint8Array | null = null;
  let dh4: Uint8Array | null = null;

  try {
    // DH1 = DH(SPK_B, IK_A) == DH(IK_A, SPK_B)
    dh1 = deriveSharedSecret(bobSpkPriv, aliceIdentityPub);

    // DH2 = DH(IK_B, EK_A) == DH(EK_A, IK_B)
    dh2 = deriveSharedSecret(bobIdentityPriv, aliceEphemeralPub);

    // DH3 = DH(SPK_B, EK_A) == DH(EK_A, SPK_B)
    dh3 = deriveSharedSecret(bobSpkPriv, aliceEphemeralPub);

    let ikm: Uint8Array;

    if (header.oneTimePrekeyId !== undefined) {
      if (!bobOpkPriv) {
        throw new Error(`X3DH receiver failed: message specified OPK ${header.oneTimePrekeyId} but private key is missing`);
      }
      // DH4 = DH(OPK_B, EK_A) == DH(EK_A, OPK_B)
      dh4 = deriveSharedSecret(bobOpkPriv, aliceEphemeralPub);

      ikm = new Uint8Array(128);
      ikm.set(dh1, 0);
      ikm.set(dh2, 32);
      ikm.set(dh3, 64);
      ikm.set(dh4, 96);
    } else {
      ikm = new Uint8Array(96);
      ikm.set(dh1, 0);
      ikm.set(dh2, 32);
      ikm.set(dh3, 64);
    }

    const sharedMasterKey = hkdf(sha256, ikm, new Uint8Array(32), DOMAIN_X3DH_MASTER, 32);
    zeroize(ikm);

    return sharedMasterKey;
  } finally {
    if (dh1) zeroize(dh1);
    if (dh2) zeroize(dh2);
    if (dh3) zeroize(dh3);
    if (dh4) zeroize(dh4);
  }
}
