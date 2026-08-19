/**
 * Double Ratchet Engine for VEIL.
 *
 * Implements the full Signal Double Ratchet specification:
 * - Asymmetric Diffie-Hellman Ratchet (X25519)
 * - Symmetric KDF Ratchet (HKDF-SHA256 & HMAC-SHA256)
 * - Out-of-order and skipped message key management (bounded to prevent DoS)
 * - Memory zeroization of message keys upon single use
 * - Encrypted serialization for local SpaceStore persistence
 */

import {
  generateKeyAgreementKeypair,
  deriveSharedSecret,
  KeyAgreementKeypair,
} from '../identity/keyAgreement.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes, randomBytes, constantTimeEquals } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import {
  kdfRK,
  kdfCK,
  canonicalizeRatchetHeader,
} from './kdf.ts';
import {
  RatchetMessage,
  RatchetMessageHeader,
  PersistedRatchetState,
  MAX_SKIPPED_KEYS,
  X3DHInitiationHeader,
} from './types.ts';

export class DoubleRatchetSession {
  public sessionId: string;
  public peerIdentityId: string;
  public peerSigningKeyPub: string;
  public peerKeyAgreementPub: string;

  // Asymmetric DH ratchet state
  private dhSendingKeypair: KeyAgreementKeypair;
  private dhReceivingPub: Uint8Array | null = null;

  // Symmetric chain states
  private rootKey: Uint8Array;
  private sendingChainKey: Uint8Array | null = null;
  private receivingChainKey: Uint8Array | null = null;

  // Sequence counters
  private ns = 0; // Number of messages sent in current sending chain
  private nr = 0; // Number of messages received in current receiving chain
  private pn = 0; // Previous sending chain length

  // Skipped message keys: "ratchetPubB64:sequenceNum" -> 32-byte MessageKey
  private skippedMessageKeys = new Map<string, Uint8Array>();

  private createdAt: number;
  private lastActiveAt: number;

  private constructor(
    sessionId: string,
    peerIdentityId: string,
    peerSigningKeyPub: string,
    peerKeyAgreementPub: string,
    rootKey: Uint8Array,
    dhSendingKeypair: KeyAgreementKeypair
  ) {
    this.sessionId = sessionId;
    this.peerIdentityId = peerIdentityId;
    this.peerSigningKeyPub = peerSigningKeyPub;
    this.peerKeyAgreementPub = peerKeyAgreementPub;
    this.rootKey = new Uint8Array(rootKey);
    this.dhSendingKeypair = dhSendingKeypair;
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();
  }

  /**
   * Initializes session for the Initiator (Alice) after X3DH key agreement.
   */
  public static initAlice(
    sessionId: string,
    peerIdentityId: string,
    peerSigningKeyPub: string,
    peerKeyAgreementPub: string,
    sharedMasterKey: Uint8Array,
    bobRatchetPublicKey: Uint8Array
  ): DoubleRatchetSession {
    const aliceDhKeypair = generateKeyAgreementKeypair(randomBytes(32));
    const session = new DoubleRatchetSession(
      sessionId,
      peerIdentityId,
      peerSigningKeyPub,
      peerKeyAgreementPub,
      sharedMasterKey,
      aliceDhKeypair
    );

    session.dhReceivingPub = new Uint8Array(bobRatchetPublicKey);

    // Alice performs initial DH ratchet step to derive sending chain key
    const dhSecret = deriveSharedSecret(aliceDhKeypair.privateKey, session.dhReceivingPub);
    const { newRootKey, newChainKey } = kdfRK(session.rootKey, dhSecret);
    zeroize(dhSecret);
    zeroize(session.rootKey);

    session.rootKey = newRootKey;
    session.sendingChainKey = newChainKey;

    return session;
  }

  /**
   * Initializes session for the Receiver (Bob) after X3DH key agreement.
   */
  public static initBob(
    sessionId: string,
    peerIdentityId: string,
    peerSigningKeyPub: string,
    peerKeyAgreementPub: string,
    sharedMasterKey: Uint8Array,
    bobDhKeypair: KeyAgreementKeypair
  ): DoubleRatchetSession {
    const session = new DoubleRatchetSession(
      sessionId,
      peerIdentityId,
      peerSigningKeyPub,
      peerKeyAgreementPub,
      sharedMasterKey,
      bobDhKeypair
    );

    // Bob starts with no receiving key until Alice sends her first ratchet message
    session.dhReceivingPub = null;
    session.sendingChainKey = null;
    session.receivingChainKey = null;

    return session;
  }

  /**
   * Encrypts a plaintext message under the current sending chain.
   * Advances the sending chain key and produces a single-use message key.
   */
  public ratchetEncrypt(
    plaintext: Uint8Array | string,
    x3dhHeader?: X3DHInitiationHeader
  ): RatchetMessage {
    if (!this.sendingChainKey) {
      throw new Error('DoubleRatchet encrypt failed: sending chain key is not initialized');
    }

    const plaintextBytes = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;

    // 1. Advance sending chain: (CKs, MK) = kdfCK(CKs)
    const { nextChainKey, messageKey } = kdfCK(this.sendingChainKey);
    zeroize(this.sendingChainKey);
    this.sendingChainKey = nextChainKey;

    // 2. Build authenticated header
    const header: RatchetMessageHeader = {
      version: 1,
      dhRatchetPub: bytesToBase64(this.dhSendingKeypair.publicKey),
      sequenceNum: this.ns,
      prevChainLength: this.pn,
      x3dhHeader,
    };

    // 3. Authenticated encryption with AAD = canonical(header)
    const aad = canonicalizeRatchetHeader(header);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(messageKey, plaintextBytes, aad);

    // 4. Zeroize message key immediately after use
    zeroize(messageKey);

    this.ns += 1;
    this.lastActiveAt = Date.now();

    return {
      header,
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
    };
  }

  /**
   * Decrypts an incoming RatchetMessage.
   * Performs DH ratchet steps as needed and handles out-of-order / skipped keys.
   */
  public ratchetDecrypt(message: RatchetMessage): Uint8Array {
    const remoteRatchetPub = base64ToBytes(message.header.dhRatchetPub);
    const remotePubB64 = message.header.dhRatchetPub;
    const seq = message.header.sequenceNum;
    const skippedKeyId = `${remotePubB64}:${seq}`;

    // 1. Check if key is already in skipped message keys
    const skippedMk = this.skippedMessageKeys.get(skippedKeyId);
    if (skippedMk) {
      this.skippedMessageKeys.delete(skippedKeyId);
      try {
        const aad = canonicalizeRatchetHeader(message.header);
        const nonce = base64ToBytes(message.nonce);
        const ct = base64ToBytes(message.ciphertext);
        return decryptXChaCha20Poly1305(skippedMk, nonce, ct, aad);
      } finally {
        zeroize(skippedMk);
      }
    }

    // 2. If message contains a new DH ratchet public key, perform DH ratchet step
    const isNewRatchetKey = !this.dhReceivingPub ||
      !constantTimeEquals(this.dhReceivingPub, remoteRatchetPub);

    if (isNewRatchetKey) {
      // Skip any remaining message keys on previous receiving chain
      this.skipMessageKeys(message.header.prevChainLength);
      // Perform DH Ratchet
      this.dhRatchetStep(remoteRatchetPub);
    }

    // 3. Skip message keys in the current receiving chain up to target sequenceNum
    this.skipMessageKeys(seq);

    // 4. Derive message key: (CKr, MK) = kdfCK(CKr)
    if (!this.receivingChainKey) {
      throw new Error('DoubleRatchet decrypt failed: receiving chain key is null');
    }

    const { nextChainKey, messageKey } = kdfCK(this.receivingChainKey);
    zeroize(this.receivingChainKey);
    this.receivingChainKey = nextChainKey;
    this.nr += 1;

    // 5. Authenticate and decrypt with AAD
    try {
      const aad = canonicalizeRatchetHeader(message.header);
      const nonce = base64ToBytes(message.nonce);
      const ct = base64ToBytes(message.ciphertext);
      const plaintext = decryptXChaCha20Poly1305(messageKey, nonce, ct, aad);
      this.lastActiveAt = Date.now();
      return plaintext;
    } finally {
      zeroize(messageKey);
    }
  }

  /**
   * Advances receiving chain and stores skipped message keys up to target sequence number.
   */
  private skipMessageKeys(until: number): void {
    if (!this.receivingChainKey || !this.dhReceivingPub) return;

    if (this.nr + 1000 < until) {
      throw new Error('DoubleRatchet: excessive message gap (possible denial of service)');
    }

    while (this.nr < until) {
      const { nextChainKey, messageKey } = kdfCK(this.receivingChainKey);
      zeroize(this.receivingChainKey);
      this.receivingChainKey = nextChainKey;

      const keyId = `${bytesToBase64(this.dhReceivingPub)}:${this.nr}`;
      this.storeSkippedKey(keyId, messageKey);
      this.nr += 1;
    }
  }

  /**
   * Executes a DH Ratchet step when peer sends a new DH ratchet public key.
   */
  private dhRatchetStep(remoteRatchetPub: Uint8Array): void {
    this.pn = this.ns;
    this.ns = 0;
    this.nr = 0;
    this.dhReceivingPub = new Uint8Array(remoteRatchetPub);

    // 1. Receiving step: (RK, CKr) = kdfRK(RK, DH(DHs_priv, DHr_pub))
    const dhSecretRecv = deriveSharedSecret(this.dhSendingKeypair.privateKey, this.dhReceivingPub);
    const recvResult = kdfRK(this.rootKey, dhSecretRecv);
    zeroize(dhSecretRecv);
    zeroize(this.rootKey);
    if (this.receivingChainKey) zeroize(this.receivingChainKey);

    this.rootKey = recvResult.newRootKey;
    this.receivingChainKey = recvResult.newChainKey;

    // 2. Generate new sending keypair
    zeroize(this.dhSendingKeypair.privateKey);
    this.dhSendingKeypair = generateKeyAgreementKeypair(randomBytes(32));

    // 3. Sending step: (RK, CKs) = kdfRK(RK, DH(new_DHs_priv, DHr_pub))
    const dhSecretSend = deriveSharedSecret(this.dhSendingKeypair.privateKey, this.dhReceivingPub);
    const sendResult = kdfRK(this.rootKey, dhSecretSend);
    zeroize(dhSecretSend);
    zeroize(this.rootKey);
    if (this.sendingChainKey) zeroize(this.sendingChainKey);

    this.rootKey = sendResult.newRootKey;
    this.sendingChainKey = sendResult.newChainKey;
  }

  private storeSkippedKey(keyId: string, key: Uint8Array): void {
    if (this.skippedMessageKeys.size >= MAX_SKIPPED_KEYS) {
      // Evict oldest skipped key to bound memory
      const oldestKey = this.skippedMessageKeys.keys().next().value;
      if (oldestKey) {
        const oldBuf = this.skippedMessageKeys.get(oldestKey);
        if (oldBuf) zeroize(oldBuf);
        this.skippedMessageKeys.delete(oldestKey);
      }
    }
    this.skippedMessageKeys.set(keyId, key);
  }

  /**
   * Serializes session to a plain object for encrypted persistence.
   */
  public serialize(): PersistedRatchetState {
    const skippedObj: Record<string, string> = {};
    for (const [k, v] of this.skippedMessageKeys.entries()) {
      skippedObj[k] = bytesToBase64(v);
    }

    return {
      version: 1,
      sessionId: this.sessionId,
      peerIdentityId: this.peerIdentityId,
      peerSigningKeyPub: this.peerSigningKeyPub,
      peerKeyAgreementPub: this.peerKeyAgreementPub,
      dhSendingPriv: bytesToBase64(this.dhSendingKeypair.privateKey),
      dhSendingPub: bytesToBase64(this.dhSendingKeypair.publicKey),
      dhReceivingPub: this.dhReceivingPub ? bytesToBase64(this.dhReceivingPub) : '',
      rootKey: bytesToBase64(this.rootKey),
      sendingChainKey: this.sendingChainKey ? bytesToBase64(this.sendingChainKey) : '',
      receivingChainKey: this.receivingChainKey ? bytesToBase64(this.receivingChainKey) : '',
      ns: this.ns,
      nr: this.nr,
      pn: this.pn,
      skippedMessageKeys: skippedObj,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
    };
  }

  /**
   * Deserializes a session from persisted state.
   */
  public static deserialize(state: PersistedRatchetState): DoubleRatchetSession {
    const dhKeypair: KeyAgreementKeypair = {
      privateKey: base64ToBytes(state.dhSendingPriv),
      publicKey: base64ToBytes(state.dhSendingPub),
    };

    const session = new DoubleRatchetSession(
      state.sessionId,
      state.peerIdentityId,
      state.peerSigningKeyPub,
      state.peerKeyAgreementPub,
      base64ToBytes(state.rootKey),
      dhKeypair
    );

    session.dhReceivingPub = state.dhReceivingPub ? base64ToBytes(state.dhReceivingPub) : null;
    session.sendingChainKey = state.sendingChainKey ? base64ToBytes(state.sendingChainKey) : null;
    session.receivingChainKey = state.receivingChainKey ? base64ToBytes(state.receivingChainKey) : null;
    session.ns = state.ns;
    session.nr = state.nr;
    session.pn = state.pn;
    session.createdAt = state.createdAt;
    session.lastActiveAt = state.lastActiveAt;

    for (const [k, v] of Object.entries(state.skippedMessageKeys)) {
      session.skippedMessageKeys.set(k, base64ToBytes(v));
    }

    return session;
  }

  /**
   * Destroys session and zeroes all volatile keys from memory.
   */
  public destroy(): void {
    zeroize(this.rootKey);
    zeroize(this.dhSendingKeypair.privateKey);
    if (this.sendingChainKey) zeroize(this.sendingChainKey);
    if (this.receivingChainKey) zeroize(this.receivingChainKey);
    for (const k of this.skippedMessageKeys.values()) {
      zeroize(k);
    }
    this.skippedMessageKeys.clear();
  }
}
