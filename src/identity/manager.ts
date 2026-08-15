/**
 * Space Identity Manager for VEIL.
 *
 * Manages the lifecycle of per-Space cryptographic identities:
 * creation, persistence (encrypted), loading, signing, key agreement,
 * and memory cleanup.
 *
 * Identity keys are derived deterministically from the Space Master Key
 * via two-tier HKDF:
 *   SMK → identitySeed → {signingKeyMaterial, keyAgreementMaterial}
 */

import { zeroize } from '../crypto/memory.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import {
  deriveIdentitySeed,
  deriveSigningKeyMaterial,
  deriveKeyAgreementMaterial,
} from '../crypto/hkdf.ts';
import { generateSigningKeypair, sign as edSign, verify as edVerify } from './signing.ts';
import { generateKeyAgreementKeypair, deriveSharedSecret as x25519SharedSecret } from './keyAgreement.ts';
import { createIdentityDocument, verifyIdentityDocument, type IdentityDocument } from './document.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';

/** Storage keys for encrypted identity data */
const IDENTITY_STORE_KEY = 'veil:identity:document';
const IDENTITY_SIGNING_PRIV_KEY = 'veil:identity:signing-private';
const IDENTITY_KA_PRIV_KEY = 'veil:identity:ka-private';

/** Loaded identity state (in-memory only while Space is unlocked) */
export interface LoadedIdentity {
  document: IdentityDocument;
  signingPrivateKey: Uint8Array;
  keyAgreementPrivateKey: Uint8Array;
}

export class SpaceIdentityManager {

  /**
   * Creates a new identity for an unlocked Space.
   * Derives identity keys deterministically from SMK via HKDF.
   * Persists private keys encrypted under the Space's StorageKey.
   *
   * @param session Active unlocked SpaceSession
   * @param store EncryptedSpaceStore for the Space
   * @returns The public IdentityDocument
   */
  public createIdentity(session: SpaceSession, store: EncryptedSpaceStore): IdentityDocument {
    if (!session.isActive()) {
      throw new Error('Cannot create identity: Space session is locked or destroyed');
    }

    const smk = session.getMasterKey();
    let identitySeed: Uint8Array | null = null;
    let signingMaterial: Uint8Array | null = null;
    let kaMaterial: Uint8Array | null = null;

    try {
      // 1. Derive identity seed from SMK
      identitySeed = deriveIdentitySeed(smk);

      // 2. Derive domain-separated key material
      signingMaterial = deriveSigningKeyMaterial(identitySeed);
      kaMaterial = deriveKeyAgreementMaterial(identitySeed);

      // 3. Generate keypairs
      const signingKeypair = generateSigningKeypair(signingMaterial);
      const kaKeypair = generateKeyAgreementKeypair(kaMaterial);

      // 4. Create self-signed identity document
      const doc = createIdentityDocument(
        signingKeypair.privateKey,
        signingKeypair.publicKey,
        kaKeypair.publicKey,
        Date.now()
      );

      // 5. Persist encrypted private keys and document via Space store
      store.set(session, IDENTITY_STORE_KEY, doc);
      store.set(session, IDENTITY_SIGNING_PRIV_KEY, bytesToBase64(signingKeypair.privateKey));
      store.set(session, IDENTITY_KA_PRIV_KEY, bytesToBase64(kaKeypair.privateKey));

      // 6. Clean up intermediate key material
      zeroize(signingKeypair.privateKey);
      zeroize(kaKeypair.privateKey);

      return doc;
    } finally {
      if (identitySeed) zeroize(identitySeed);
      if (signingMaterial) zeroize(signingMaterial);
      if (kaMaterial) zeroize(kaMaterial);
    }
  }

  /**
   * Loads the persisted identity from encrypted storage.
   *
   * @param session Active unlocked SpaceSession
   * @param store EncryptedSpaceStore for the Space
   * @returns LoadedIdentity with document and private keys, or null if no identity exists
   */
  public loadIdentity(session: SpaceSession, store: EncryptedSpaceStore): LoadedIdentity | null {
    if (!session.isActive()) {
      throw new Error('Cannot load identity: Space session is locked or destroyed');
    }

    const doc = store.get<IdentityDocument>(session, IDENTITY_STORE_KEY);
    if (!doc) return null;

    const signingPrivB64 = store.get<string>(session, IDENTITY_SIGNING_PRIV_KEY);
    const kaPrivB64 = store.get<string>(session, IDENTITY_KA_PRIV_KEY);

    if (!signingPrivB64 || !kaPrivB64) {
      throw new Error('Identity corrupted: missing private key material');
    }

    return {
      document: doc,
      signingPrivateKey: base64ToBytes(signingPrivB64),
      keyAgreementPrivateKey: base64ToBytes(kaPrivB64),
    };
  }

  /**
   * Returns the public identity document without private keys.
   */
  public getPublicDocument(session: SpaceSession, store: EncryptedSpaceStore): IdentityDocument | null {
    if (!session.isActive()) {
      throw new Error('Cannot get identity: Space session is locked or destroyed');
    }

    return store.get<IdentityDocument>(session, IDENTITY_STORE_KEY);
  }

  /**
   * Signs a message using the Space's Ed25519 signing key.
   *
   * @param session Active unlocked SpaceSession
   * @param store EncryptedSpaceStore
   * @param message Message bytes to sign
   * @returns 64-byte Ed25519 signature
   */
  public signMessage(session: SpaceSession, store: EncryptedSpaceStore, message: Uint8Array): Uint8Array {
    const identity = this.loadIdentity(session, store);
    if (!identity) {
      throw new Error('No identity found for this Space');
    }

    try {
      return edSign(identity.signingPrivateKey, message);
    } finally {
      zeroize(identity.signingPrivateKey);
      zeroize(identity.keyAgreementPrivateKey);
    }
  }

  /**
   * Verifies an Ed25519 signature against a public key.
   * Static operation — does not require a session.
   */
  public verifySignature(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
    return edVerify(publicKey, message, signature);
  }

  /**
   * Performs X25519 Diffie-Hellman key agreement with a peer.
   *
   * @param session Active unlocked SpaceSession
   * @param store EncryptedSpaceStore
   * @param peerPublicKey 32-byte X25519 public key of the peer
   * @returns 32-byte shared secret
   */
  public computeSharedSecret(
    session: SpaceSession,
    store: EncryptedSpaceStore,
    peerPublicKey: Uint8Array
  ): Uint8Array {
    const identity = this.loadIdentity(session, store);
    if (!identity) {
      throw new Error('No identity found for this Space');
    }

    try {
      return x25519SharedSecret(identity.keyAgreementPrivateKey, peerPublicKey);
    } finally {
      zeroize(identity.signingPrivateKey);
      zeroize(identity.keyAgreementPrivateKey);
    }
  }

  /**
   * Checks if an identity has been created for a Space.
   */
  public hasIdentity(session: SpaceSession, store: EncryptedSpaceStore): boolean {
    if (!session.isActive()) return false;
    return store.get(session, IDENTITY_STORE_KEY) !== null;
  }
}
