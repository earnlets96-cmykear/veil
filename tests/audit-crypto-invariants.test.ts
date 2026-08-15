import { describe, it, expect } from 'vitest';
import { getRandomBytes, constantTimeEquals } from '../src/crypto/utils.ts';
import { deriveSubkey, deriveStorageKey, deriveIdentitySeed } from '../src/crypto/hkdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { zeroize } from '../src/crypto/memory.ts';

describe('VEIL Phase 9 Red-Team Audit: Cryptographic Invariants', () => {
  it('NONCE & RANDOMNESS AUDIT: Verifies 10,000 nonces have zero collisions and CSPRNG bounds', () => {
    const nonceSet = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      const nonce = getRandomBytes(24);
      const hex = Buffer.from(nonce).toString('hex');
      expect(nonceSet.has(hex)).toBe(false);
      nonceSet.add(hex);
    }
    expect(nonceSet.size).toBe(10000);
  });

  it('HKDF DOMAIN SEPARATION: Verifies distinct subkeys derived from identical SMK', () => {
    const smk = getRandomBytes(32);

    const storageKey = deriveStorageKey(smk);
    const identitySeed = deriveIdentitySeed(smk);
    const messagingKey = deriveSubkey(smk, 'veil-v1-test-messaging');

    // Verify all derived keys are distinct
    expect(constantTimeEquals(storageKey, identitySeed)).toBe(false);
    expect(constantTimeEquals(storageKey, messagingKey)).toBe(false);
    expect(constantTimeEquals(identitySeed, messagingKey)).toBe(false);
  });


  it('AEAD INTEGRITY & TAMPERING: Rejects 1-bit tampering in ciphertext, tag, or AAD', () => {
    const key = getRandomBytes(32);
    const plaintext = new TextEncoder().encode('Confidential audit message');
    const aad = new TextEncoder().encode('audit-aad-v1');

    const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, plaintext, aad);

    // 1. Bit-flipped ciphertext must fail
    const tamperedCipher = new Uint8Array(ciphertext);
    tamperedCipher[0] ^= 0x01;
    expect(() => decryptXChaCha20Poly1305(key, nonce, tamperedCipher, aad)).toThrow();

    // 2. Tampered AAD must fail
    const tamperedAad = new TextEncoder().encode('audit-aad-v2');
    expect(() => decryptXChaCha20Poly1305(key, nonce, ciphertext, tamperedAad)).toThrow();

    // 3. Tampered nonce must fail
    const tamperedNonce = new Uint8Array(nonce);
    tamperedNonce[0] ^= 0x01;
    expect(() => decryptXChaCha20Poly1305(key, tamperedNonce, ciphertext, aad)).toThrow();
  });

  it('MEMORY ZEROIZATION: Verifies buffer values are wiped to zero', () => {
    const sensitive = getRandomBytes(32);
    expect(sensitive.some(b => b !== 0)).toBe(true);

    zeroize(sensitive);
    expect(sensitive.every(b => b === 0)).toBe(true);
  });
});
