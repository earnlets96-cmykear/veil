import { describe, it, expect } from 'vitest';
import { deriveStorageKey, deriveIdentitySeed, deriveSigningKeyMaterial, deriveKeyAgreementMaterial } from '../src/crypto/hkdf.ts';
import { randomBytes, bytesToHex } from '../src/crypto/utils.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';

describe('VEIL Phase 18: Formal Cryptographic Invariants & Domain Separation', () => {
  it('CSPRNG NONCE UNIQUENESS: 10,000 generated 24-byte nonces exhibit zero collisions', () => {
    const nonceSet = new Set<string>();
    const count = 10000;

    for (let i = 0; i < count; i++) {
      const nonce = bytesToHex(randomBytes(24));
      nonceSet.add(nonce);
    }

    expect(nonceSet.size).toBe(count);
  });

  it('HKDF DOMAIN SEPARATION: Strictly distinct keys derived from the same Space Master Key (SMK)', () => {
    const smk = randomBytes(32);

    const storageKey = deriveStorageKey(smk);
    const identitySeed = deriveIdentitySeed(smk);
    const signingMaterial = deriveSigningKeyMaterial(identitySeed);
    const kaMaterial = deriveKeyAgreementMaterial(identitySeed);

    const keySet = new Set([
      bytesToHex(storageKey),
      bytesToHex(identitySeed),
      bytesToHex(signingMaterial),
      bytesToHex(kaMaterial),
    ]);

    // All derived keys must be mathematically distinct with 0 overlaps
    expect(keySet.size).toBe(4);
  });

  it('SIGNING & KEY AGREEMENT ASYMMETRIC KEY DERIVATION: Produces valid cryptographic keypairs', () => {
    const smk = randomBytes(32);
    const identitySeed = deriveIdentitySeed(smk);
    const signingMaterial = deriveSigningKeyMaterial(identitySeed);
    const kaMaterial = deriveKeyAgreementMaterial(identitySeed);

    const signKp = generateSigningKeypair(signingMaterial);
    const kaKp = generateKeyAgreementKeypair(kaMaterial);

    expect(signKp.publicKey).toHaveLength(32);
    expect(signKp.privateKey).toHaveLength(32);
    expect(kaKp.publicKey).toHaveLength(32);
    expect(kaKp.privateKey).toHaveLength(32);

    // Re-running derivation from same seed produces identical keys
    const signKp2 = generateSigningKeypair(signingMaterial);
    expect(bytesToHex(signKp.publicKey)).toBe(bytesToHex(signKp2.publicKey));
  });
});
