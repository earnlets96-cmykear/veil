import { describe, it, expect } from 'vitest';
import { generateSigningKeypair, sign, verify } from '../src/identity/signing.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { deriveSigningKeyMaterial } from '../src/crypto/hkdf.ts';

describe('VEIL Phase 2: Ed25519 Signature Tests', () => {
  it('AUTHORIZED: correct signature verifies successfully', () => {
    const seed = randomBytes(32);
    const keypair = generateSigningKeypair(seed);
    const message = new TextEncoder().encode('Hello, VEIL Space identity!');

    const signature = sign(keypair.privateKey, message);
    expect(signature.length).toBe(64);
    expect(verify(keypair.publicKey, message, signature)).toBe(true);
  });

  it('AUTHORIZED: third party verifies using signer public key', () => {
    const seed = randomBytes(32);
    const keypair = generateSigningKeypair(seed);
    const message = new TextEncoder().encode('Signed by Space A');
    const signature = sign(keypair.privateKey, message);

    // Bob (different keypair) uses Alice's PUBLIC key to verify — must succeed
    expect(verify(keypair.publicKey, message, signature)).toBe(true);
  });

  it('UNAUTHORIZED: modified message fails verification', () => {
    const seed = randomBytes(32);
    const keypair = generateSigningKeypair(seed);
    const message = new TextEncoder().encode('Original message');
    const signature = sign(keypair.privateKey, message);

    const tampered = new TextEncoder().encode('Tampered message');
    expect(verify(keypair.publicKey, tampered, signature)).toBe(false);
  });

  it('UNAUTHORIZED: modified signature fails verification', () => {
    const seed = randomBytes(32);
    const keypair = generateSigningKeypair(seed);
    const message = new TextEncoder().encode('Test message');
    const signature = sign(keypair.privateKey, message);

    const corruptSig = new Uint8Array(signature);
    corruptSig[0] ^= 0xFF;
    expect(verify(keypair.publicKey, message, corruptSig)).toBe(false);
  });

  it('UNAUTHORIZED: wrong public key fails verification', () => {
    const seed1 = randomBytes(32);
    const seed2 = randomBytes(32);
    const keypairA = generateSigningKeypair(seed1);
    const keypairB = generateSigningKeypair(seed2);

    const message = new TextEncoder().encode('Signed by A');
    const signature = sign(keypairA.privateKey, message);

    // B's public key cannot verify A's signature
    expect(verify(keypairB.publicKey, message, signature)).toBe(false);
  });

  it('should produce deterministic keypairs from the same seed', () => {
    const seed = randomBytes(32);
    const kp1 = generateSigningKeypair(seed);
    const kp2 = generateSigningKeypair(seed);

    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(true);
  });

  it('should produce different keypairs from different seeds', () => {
    const kp1 = generateSigningKeypair(randomBytes(32));
    const kp2 = generateSigningKeypair(randomBytes(32));

    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(false);
  });
});
