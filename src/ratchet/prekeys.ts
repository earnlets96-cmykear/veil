/**
 * Prekey Generation, Storage & Management for VEIL.
 *
 * Implements:
 * - Signed Prekeys (SPKs) signed by Space's Ed25519 identity key.
 * - Ephemeral One-Time Prekey (OPK) pools stored encrypted at rest.
 * - Public PrekeyBundle creation for asynchronous X3DH session handshakes.
 */

import { generateKeyAgreementKeypair, KeyAgreementKeypair } from '../identity/keyAgreement.ts';
import { sign as edSign, verify as edVerify } from '../identity/signing.ts';
import { bytesToBase64, base64ToBytes, randomBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import { SignedPrekey, OneTimePrekey, PrekeyBundle } from './types.ts';
import type { IdentityDocument } from '../identity/document.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { SpaceIdentityManager } from '../identity/manager.ts';

const SIGNED_PREKEY_STORE_KEY = 'veil:prekeys:signed';
const ONE_TIME_PREKEYS_STORE_KEY = 'veil:prekeys:one_time';

interface StoredSignedPrekey {
  id: number;
  privateKey: string;        // Base64 X25519 private key
  publicKey: string;         // Base64 X25519 public key
  signature: string;         // Base64 Ed25519 signature
  createdAt: number;
}

interface StoredOneTimePrekey {
  id: number;
  privateKey: string;        // Base64 X25519 private key
  publicKey: string;         // Base64 X25519 public key
  createdAt: number;
}

export class PrekeyManager {
  private store: EncryptedSpaceStore;
  private idMgr: SpaceIdentityManager;

  constructor(store: EncryptedSpaceStore, idMgr: SpaceIdentityManager) {
    this.store = store;
    this.idMgr = idMgr;
  }

  /**
   * Generates a new Signed Prekey, signs its public key with the Space's Ed25519 identity key,
   * and saves it encrypted in the Space store.
   */
  public generateSignedPrekey(session: SpaceSession, spkId: number = Date.now()): SignedPrekey {
    this.assertSession(session);

    const keypair = generateKeyAgreementKeypair(randomBytes(32));
    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) {
      throw new Error('Cannot generate signed prekey: Space has no identity');
    }

    // Canonical payload to sign: spkPublicKeyBytes || 4-byte big-endian spkId
    const spkIdBytes = new Uint8Array(4);
    new DataView(spkIdBytes.buffer).setUint32(0, spkId, false);

    const signPayload = new Uint8Array(keypair.publicKey.length + 4);
    signPayload.set(keypair.publicKey, 0);
    signPayload.set(spkIdBytes, keypair.publicKey.length);

    // Sign with Space's Ed25519 private key
    const signature = edSign(identity.signingPrivateKey, signPayload);

    // Persist in Space store
    const stored: StoredSignedPrekey = {
      id: spkId,
      privateKey: bytesToBase64(keypair.privateKey),
      publicKey: bytesToBase64(keypair.publicKey),
      signature: bytesToBase64(signature),
      createdAt: Date.now(),
    };
    this.store.set(session, SIGNED_PREKEY_STORE_KEY, stored);

    // Zeroize sensitive volatile buffers
    zeroize(keypair.privateKey);
    zeroize(identity.signingPrivateKey);
    zeroize(identity.keyAgreementPrivateKey);

    return {
      id: spkId,
      publicKey: stored.publicKey,
      signature: stored.signature,
      createdAt: stored.createdAt,
    };
  }

  /**
   * Generates a batch of ephemeral One-Time Prekeys (OPKs) and saves them in encrypted storage.
   */
  public generateOneTimePrekeys(session: SpaceSession, count = 10): OneTimePrekey[] {
    this.assertSession(session);

    const existing = this.loadOneTimePrekeys(session);
    const newOPKs: StoredOneTimePrekey[] = [];
    const publicOPKs: OneTimePrekey[] = [];

    const startId = existing.length > 0 ? Math.max(...existing.map(p => p.id)) + 1 : 1;

    for (let i = 0; i < count; i++) {
      const id = startId + i;
      const keypair = generateKeyAgreementKeypair(randomBytes(32));

      const stored: StoredOneTimePrekey = {
        id,
        privateKey: bytesToBase64(keypair.privateKey),
        publicKey: bytesToBase64(keypair.publicKey),
        createdAt: Date.now(),
      };

      newOPKs.push(stored);
      publicOPKs.push({ id, publicKey: stored.publicKey });
      zeroize(keypair.privateKey);
    }

    this.store.set(session, ONE_TIME_PREKEYS_STORE_KEY, [...existing, ...newOPKs]);
    return publicOPKs;
  }

  /**
   * Creates a public PrekeyBundle containing identity doc, signed prekey, and one available OPK.
   */
  public createPrekeyBundle(session: SpaceSession): PrekeyBundle {
    this.assertSession(session);

    const doc = this.idMgr.getPublicDocument(session, this.store);
    if (!doc) {
      throw new Error('Cannot create prekey bundle: Space has no identity document');
    }

    let spk = this.getSignedPrekeyPublic(session);
    if (!spk) {
      spk = this.generateSignedPrekey(session);
    }

    const opks = this.loadOneTimePrekeys(session);
    let opk: OneTimePrekey | undefined;
    if (opks.length > 0) {
      opk = { id: opks[0].id, publicKey: opks[0].publicKey };
    }

    return {
      version: 1,
      identityDocument: doc,
      signedPrekey: spk,
      oneTimePrekey: opk,
    };
  }

  /**
   * Alias for createPrekeyBundle.
   */
  public generatePrekeyBundle(session: SpaceSession): PrekeyBundle {
    return this.createPrekeyBundle(session);
  }

  /**
   * Consumes and retrieves a One-Time Prekey's private key, permanently removing it from storage.
   */
  public consumeOneTimePrekey(session: SpaceSession, opkId: number): Uint8Array | null {
    this.assertSession(session);

    const opks = this.loadOneTimePrekeys(session);
    const index = opks.findIndex(p => p.id === opkId);
    if (index === -1) return null;

    const opk = opks[index];
    const privBytes = base64ToBytes(opk.privateKey);

    // Remove from store permanently
    opks.splice(index, 1);
    this.store.set(session, ONE_TIME_PREKEYS_STORE_KEY, opks);

    return privBytes;
  }

  /**
   * Retrieves the private key for a Signed Prekey.
   */
  public getSignedPrekeyPrivate(session: SpaceSession, spkId: number): Uint8Array | null {
    this.assertSession(session);

    const stored = this.store.get<StoredSignedPrekey>(session, SIGNED_PREKEY_STORE_KEY);
    if (!stored || stored.id !== spkId) return null;

    return base64ToBytes(stored.privateKey);
  }

  /**
   * Retrieves public Signed Prekey.
   */
  public getSignedPrekeyPublic(session: SpaceSession): SignedPrekey | null {
    this.assertSession(session);

    const stored = this.store.get<StoredSignedPrekey>(session, SIGNED_PREKEY_STORE_KEY);
    if (!stored) return null;

    return {
      id: stored.id,
      publicKey: stored.publicKey,
      signature: stored.signature,
      createdAt: stored.createdAt,
    };
  }

  /**
   * Verifies a peer's Signed Prekey signature against their public Ed25519 identity key.
   */
  public static verifySignedPrekey(
    signingPublicKey: Uint8Array,
    signedPrekey: SignedPrekey
  ): boolean {
    try {
      const spkPubBytes = base64ToBytes(signedPrekey.publicKey);
      const signatureBytes = base64ToBytes(signedPrekey.signature);

      const spkIdBytes = new Uint8Array(4);
      new DataView(spkIdBytes.buffer).setUint32(0, signedPrekey.id, false);

      const payload = new Uint8Array(spkPubBytes.length + 4);
      payload.set(spkPubBytes, 0);
      payload.set(spkIdBytes, spkPubBytes.length);

      return edVerify(signingPublicKey, payload, signatureBytes);
    } catch (_err) {
      return false;
    }
  }

  private loadOneTimePrekeys(session: SpaceSession): StoredOneTimePrekey[] {
    const raw = this.store.get<StoredOneTimePrekey[]>(session, ONE_TIME_PREKEYS_STORE_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('Prekey access rejected: Space session is locked or destroyed');
    }
  }
}
