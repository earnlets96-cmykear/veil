import { describe, it, expect } from 'vitest';
import { deriveKeyArgon2id, FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import {
  encryptXChaCha20Poly1305,
  decryptXChaCha20Poly1305,
  XCHACHA20_NONCE_LENGTH,
  POLY1305_TAG_LENGTH,
} from '../src/crypto/aead.ts';
import {
  deriveSubkey,
  deriveStorageKey,
  deriveIdentitySeed,
  DOMAIN_STORAGE,
  DOMAIN_IDENTITY,
} from '../src/crypto/hkdf.ts';
import {
  randomBytes,
  bytesToHex,
  constantTimeEquals,
} from '../src/crypto/utils.ts';
import { zeroize, withSecureBuffer } from '../src/crypto/memory.ts';

describe('VEIL Phase 1: Cryptographic Primitives Unit Tests', () => {
  describe('Argon2id Password Key Derivation', () => {
    it('should derive consistent 32-byte KEK for identical inputs', () => {
      const salt = randomBytes(32);
      const password = 'SuperSecretSpacePassword123!';

      const kek1 = deriveKeyArgon2id(password, salt, FAST_TEST_KDF_PARAMS);
      const kek2 = deriveKeyArgon2id(password, salt, FAST_TEST_KDF_PARAMS);

      expect(kek1.length).toBe(32);
      expect(constantTimeEquals(kek1, kek2)).toBe(true);
    });

    it('should produce distinct KEKs for different passwords', () => {
      const salt = randomBytes(32);
      const kek1 = deriveKeyArgon2id('PasswordAlpha', salt, FAST_TEST_KDF_PARAMS);
      const kek2 = deriveKeyArgon2id('PasswordBeta', salt, FAST_TEST_KDF_PARAMS);

      expect(constantTimeEquals(kek1, kek2)).toBe(false);
    });

    it('should produce distinct KEKs for different salts with same password', () => {
      const salt1 = randomBytes(32);
      const salt2 = randomBytes(32);
      const password = 'IdenticalPassword';

      const kek1 = deriveKeyArgon2id(password, salt1, FAST_TEST_KDF_PARAMS);
      const kek2 = deriveKeyArgon2id(password, salt2, FAST_TEST_KDF_PARAMS);

      expect(constantTimeEquals(kek1, kek2)).toBe(false);
    });

    it('should reject salts shorter than 16 bytes', () => {
      const shortSalt = new Uint8Array(15);
      expect(() => deriveKeyArgon2id('password', shortSalt)).toThrow('Salt must be at least 16 bytes');
    });
  });

  describe('XChaCha20-Poly1305 AEAD', () => {
    it('should encrypt and decrypt plaintext accurately', () => {
      const key = randomBytes(32);
      const message = 'Confidential VEIL message content payload';

      const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, message);

      expect(nonce.length).toBe(XCHACHA20_NONCE_LENGTH);
      // Ciphertext length must equal plaintext length + 16 bytes tag
      expect(ciphertext.length).toBe(new TextEncoder().encode(message).length + POLY1305_TAG_LENGTH);

      const decrypted = decryptXChaCha20Poly1305(key, nonce, ciphertext);
      expect(new TextDecoder().decode(decrypted)).toBe(message);
    });

    it('should support authenticated associated data (AAD)', () => {
      const key = randomBytes(32);
      const message = 'Authenticated data payload';
      const aad = new TextEncoder().encode('spaceId:space-12345');

      const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, message, aad);
      const decrypted = decryptXChaCha20Poly1305(key, nonce, ciphertext, aad);
      expect(new TextDecoder().decode(decrypted)).toBe(message);

      // Decryption with mismatched AAD must fail
      const wrongAad = new TextEncoder().encode('spaceId:space-wrong');
      expect(() => decryptXChaCha20Poly1305(key, nonce, ciphertext, wrongAad)).toThrow(
        'Decryption failed: corrupted ciphertext or authentication tag mismatch'
      );
    });

    it('should fail decryption if wrong key is used', () => {
      const key1 = randomBytes(32);
      const key2 = randomBytes(32);
      const message = 'Secret message';

      const { nonce, ciphertext } = encryptXChaCha20Poly1305(key1, message);

      expect(() => decryptXChaCha20Poly1305(key2, nonce, ciphertext)).toThrow(
        'Decryption failed: corrupted ciphertext or authentication tag mismatch'
      );
    });

    it('should fail decryption if ciphertext is tampered', () => {
      const key = randomBytes(32);
      const message = 'Secret message';
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, message);

      const tampered = new Uint8Array(ciphertext);
      tampered[0] ^= 0xff; // Flip bits

      expect(() => decryptXChaCha20Poly1305(key, nonce, tampered)).toThrow(
        'Decryption failed: corrupted ciphertext or authentication tag mismatch'
      );
    });

    it('should fail decryption if tag is truncated', () => {
      const key = randomBytes(32);
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, 'test');
      const truncated = ciphertext.slice(0, 10);

      expect(() => decryptXChaCha20Poly1305(key, nonce, truncated)).toThrow(
        'Ciphertext too short: missing authentication tag'
      );
    });
  });

  describe('HKDF-SHA256 Subkey Expansion', () => {
    it('should derive distinct subkeys for different domain tags from the same SMK', () => {
      const smk = randomBytes(32);

      const storageKey = deriveStorageKey(smk);
      const identitySeed = deriveIdentitySeed(smk);
      const customSubkey = deriveSubkey(smk, 'veil-v1-custom-domain');

      expect(storageKey.length).toBe(32);
      expect(identitySeed.length).toBe(32);
      expect(customSubkey.length).toBe(32);

      expect(constantTimeEquals(storageKey, identitySeed)).toBe(false);
      expect(constantTimeEquals(storageKey, customSubkey)).toBe(false);
      expect(constantTimeEquals(identitySeed, customSubkey)).toBe(false);
    });

    it('should produce identical subkeys for identical master key and domain info', () => {
      const smk = randomBytes(32);
      const k1 = deriveSubkey(smk, DOMAIN_STORAGE);
      const k2 = deriveSubkey(smk, DOMAIN_STORAGE);

      expect(constantTimeEquals(k1, k2)).toBe(true);
    });
  });

  describe('Memory Zeroization & Scoped Buffers', () => {
    it('should fill buffer with zeros upon zeroize()', () => {
      const buf = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      zeroize(buf);
      expect(buf.every(b => b === 0)).toBe(true);
    });

    it('should automatically wipe buffer in withSecureBuffer', () => {
      let ref: Uint8Array | null = null;
      withSecureBuffer(32, buf => {
        ref = buf;
        buf.fill(0xee);
      });

      expect(ref).not.toBeNull();
      expect(ref!.every(b => b === 0)).toBe(true);
    });
  });
});
