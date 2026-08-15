/**
 * VEIL Core Type Definitions
 */

export type SpaceType = 'main' | 'work' | 'private' | 'decoy';

export interface KdfParameters {
  algorithm: 'argon2id';
  salt: string;        // Base64 encoded 32-byte salt
  timeCost: number;    // Iterations (default: 3)
  memoryCost: number;  // KiB (default: 65536 = 64 MiB)
  parallelism: number; // Threads (default: 1)
  keyLength: number;   // Output bytes (32)
}

export interface EncryptedEnvelope {
  algorithm: 'XChaCha20-Poly1305' | 'AES-256-GCM';
  nonce: string;       // Base64 encoded nonce
  ciphertext: string;  // Base64 encoded ciphertext + auth tag
}

export interface SpaceHeaderEnvelope {
  spaceId: string;
  version: 1;
  name: string;
  isDecoy: boolean;
  kdfParams: KdfParameters;
  encryptedMasterKey: EncryptedEnvelope;
  createdAt: number;
}

export interface SpaceIdentity {
  spaceId: string;
  identityKeyPub: string;  // X25519 public key (Base64)
  identityKeyPriv: string; // X25519 private key (Base64)
  signingKeyPub: string;   // Ed25519 public key (Base64)
  signingKeyPriv: string;  // Ed25519 private key (Base64)
  displayName: string;
  createdAt: number;
}

export interface ContactCard {
  spaceId: string;
  identityKeyPub: string;
  signingKeyPub: string;
  displayName: string;
  safetyNumber: string;
}

export interface EncryptedMessagePayload {
  messageId: string;
  senderIdentityPub: string;
  recipientMailboxToken: string;
  ratchetHeader: {
    dhRatchetPub: string;
    sequenceNum: number;
    prevChainLength: number;
  };
  ciphertext: string;
  timestamp: number;
}
