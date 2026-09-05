/**
 * VEIL Double Ratchet & Prekey Protocol Type Definitions.
 * Implements Signal-specification compliant data structures for X3DH and Double Ratchet.
 */

import { IdentityDocument } from '../identity/document.ts';

export const RATCHET_PROTOCOL_VERSION = 1;
export const MAX_SKIPPED_KEYS = 500; // Bounded skipped-message-key limit to prevent DoS

/**
 * Medium-term Signed Prekey (X25519) signed by the Space's Ed25519 identity key.
 */
export interface SignedPrekey {
  id: number;
  publicKey: string;         // Base64 X25519 public key
  signature: string;         // Base64 Ed25519 signature over (publicKey || id)
  createdAt: number;
}

/**
 * Ephemeral One-Time Prekey (X25519) for initial session establishment.
 */
export interface OneTimePrekey {
  id: number;
  publicKey: string;         // Base64 X25519 public key
}

/**
 * Public Prekey Bundle published to the untrusted server for asynchronous handshakes.
 */
export interface PrekeyBundle {
  version: 1;
  identityDocument: IdentityDocument;
  signedPrekey: SignedPrekey;
  oneTimePrekey?: OneTimePrekey;
}

/**
 * X3DH Initial Key Agreement Header attached to the first message of a session.
 */
export interface X3DHInitiationHeader {
  ephemeralPublicKey: string; // Base64 X25519 ephemeral key of initiator
  signedPrekeyId: number;
  oneTimePrekeyId?: number;
}

/**
 * Double Ratchet Protocol Header included with every encrypted message.
 */
export interface RatchetMessageHeader {
  version: 1;
  dhRatchetPub: string;       // Base64 X25519 ratchet public key
  sequenceNum: number;        // Message index in the current sending chain (N_s)
  prevChainLength: number;    // Total messages sent in the previous chain (P_N)
  x3dhHeader?: X3DHInitiationHeader; // Present on initial message establishing session
}

/**
 * Full encrypted Double Ratchet message payload.
 */
export interface RatchetMessage {
  header: RatchetMessageHeader;
  nonce: string;              // Base64 24-byte nonce
  ciphertext: string;         // Base64 AEAD ciphertext + Poly1305 auth tag
}

/**
 * Serialized Double Ratchet session state for encrypted persistence at rest.
 */
export interface PersistedRatchetState {
  version: 1;
  sessionId: string;
  peerIdentityId: string;
  peerSigningKeyPub: string;
  peerKeyAgreementPub: string;
  
  // Asymmetric DH ratchet state
  dhSendingPriv: string;      // Base64 X25519 private key
  dhSendingPub: string;       // Base64 X25519 public key
  dhReceivingPub: string;     // Base64 X25519 public key (or empty if not yet received)
  
  // Symmetric chain states
  rootKey: string;            // Base64 32-byte Root Key (RK)
  sendingChainKey: string;    // Base64 32-byte Chain Key (CKs)
  receivingChainKey: string;  // Base64 32-byte Chain Key (CKr)
  
  // Message sequence counters
  ns: number;                 // Sending chain message counter
  nr: number;                 // Receiving chain message counter
  pn: number;                 // Previous chain length
  
  // Skipped message keys: key is "dhRatchetPub:sequenceNum", value is Base64 32-byte message key
  skippedMessageKeys: Record<string, string>;
  
  initialX3DHHeader?: X3DHInitiationHeader;

  createdAt: number;
  lastActiveAt: number;
}
