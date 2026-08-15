import { describe, it, expect } from 'vitest';
import { generateKeyAgreementKeypair, deriveSharedSecret } from '../src/identity/keyAgreement.ts';
import { randomBytes, constantTimeEquals } from '../src/crypto/utils.ts';

describe('VEIL Phase 2: X25519 Key Agreement Tests', () => {
  it('AUTHORIZED: Alice+Bob shared secret matches Bob+Alice (DH commutativity)', () => {
    const aliceKP = generateKeyAgreementKeypair(randomBytes(32));
    const bobKP = generateKeyAgreementKeypair(randomBytes(32));

    const ssAlice = deriveSharedSecret(aliceKP.privateKey, bobKP.publicKey);
    const ssBob = deriveSharedSecret(bobKP.privateKey, aliceKP.publicKey);

    expect(ssAlice.length).toBe(32);
    expect(ssBob.length).toBe(32);
    expect(constantTimeEquals(ssAlice, ssBob)).toBe(true);
  });

  it('UNAUTHORIZED: Alice+Charlie ≠ Alice+Bob', () => {
    const aliceKP = generateKeyAgreementKeypair(randomBytes(32));
    const bobKP = generateKeyAgreementKeypair(randomBytes(32));
    const charlieKP = generateKeyAgreementKeypair(randomBytes(32));

    const ssAliceBob = deriveSharedSecret(aliceKP.privateKey, bobKP.publicKey);
    const ssAliceCharlie = deriveSharedSecret(aliceKP.privateKey, charlieKP.publicKey);

    expect(constantTimeEquals(ssAliceBob, ssAliceCharlie)).toBe(false);
  });

  it('should produce deterministic keypairs from the same seed', () => {
    const seed = randomBytes(32);
    const kp1 = generateKeyAgreementKeypair(seed);
    const kp2 = generateKeyAgreementKeypair(seed);

    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(true);
  });

  it('should produce different keypairs from different seeds', () => {
    const kp1 = generateKeyAgreementKeypair(randomBytes(32));
    const kp2 = generateKeyAgreementKeypair(randomBytes(32));

    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(false);
  });

  it('should reject invalid key lengths', () => {
    expect(() => generateKeyAgreementKeypair(new Uint8Array(16))).toThrow(/expected 32 bytes/);
    const validKP = generateKeyAgreementKeypair(randomBytes(32));
    expect(() => deriveSharedSecret(new Uint8Array(16), validKP.publicKey)).toThrow(/expected 32 bytes/);
    expect(() => deriveSharedSecret(validKP.privateKey, new Uint8Array(16))).toThrow(/expected 32 bytes/);
  });
});
