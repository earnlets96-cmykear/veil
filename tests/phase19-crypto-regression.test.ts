import { describe, it, expect } from 'vitest';
import { deriveKeyArgon2id, FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { deriveStorageKey, deriveIdentitySeed } from '../src/crypto/hkdf.ts';
import { generateSigningKeypair, sign as edSign, verify as edVerify } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair, deriveSharedSecret } from '../src/identity/keyAgreement.ts';
import { randomBytes, bytesToHex } from '../src/crypto/utils.ts';

describe('VEIL Phase 19: Comprehensive Cryptographic Regression Gate', () => {
  it('ARGON2ID & XCHACHA20 AEAD REGRESSION: Salt, derivation, AEAD encryption and tamper rejection', async () => {
    const password = 'RegressionPassword123!';
    const salt = randomBytes(16);
    const key = await deriveKeyArgon2id(password, salt, FAST_TEST_KDF_PARAMS);
    expect(key).toHaveLength(32);

    const plaintext = new TextEncoder().encode('Confidential payload for regression validation');
    const aad = new TextEncoder().encode('auth_context_aad');

    const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, plaintext, aad);
    const decrypted = decryptXChaCha20Poly1305(key, nonce, ciphertext, aad);
    expect(decrypted).toEqual(plaintext);

    // Tamper with ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;
    expect(() => decryptXChaCha20Poly1305(key, nonce, tampered, aad)).toThrow();
  });

  it('HKDF & ASYMMETRIC KEY DERIVATION REGRESSION: Verifies ECDH key agreement and Ed25519 signing', () => {
    const smk = randomBytes(32);
    const storageKey = deriveStorageKey(smk);
    const identitySeed = deriveIdentitySeed(smk);
    expect(bytesToHex(storageKey)).not.toBe(bytesToHex(identitySeed));

    const aliceKp = generateSigningKeypair(randomBytes(32));
    const msg = new TextEncoder().encode('Authentic signed message');
    const sig = edSign(aliceKp.privateKey, msg);
    expect(edVerify(aliceKp.publicKey, msg, sig)).toBe(true);

    // Key agreement
    const aliceKa = generateKeyAgreementKeypair(randomBytes(32));
    const bobKa = generateKeyAgreementKeypair(randomBytes(32));

    const secretA = deriveSharedSecret(aliceKa.privateKey, bobKa.publicKey);
    const secretB = deriveSharedSecret(bobKa.privateKey, aliceKa.publicKey);
    expect(bytesToHex(secretA)).toBe(bytesToHex(secretB));
  });
});
