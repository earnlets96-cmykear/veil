import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { parseEnvelope, serializeEnvelope, validateSpaceEnvelope } from '../src/spaces/envelope.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToBase64, base64ToBytes, randomBytes } from '../src/crypto/utils.ts';
import type { SpaceHeaderEnvelope } from '../types/index.ts';

describe('VEIL Phase 1: Tampering & Corruption Adversarial Tests', () => {
  let vault: SpaceVaultManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
  });

  describe('Envelope Schema & Version Validation', () => {
    it('should reject unknown format versions', () => {
      const invalidEnv: any = {
        spaceId: 'test-1',
        version: 2, // Unsupported future version
        name: 'Future Space',
        isDecoy: false,
        kdfParams: {
          algorithm: 'argon2id',
          salt: bytesToBase64(randomBytes(32)),
          timeCost: 1,
          memoryCost: 1024,
          parallelism: 1,
          keyLength: 32,
        },
        encryptedMasterKey: {
          algorithm: 'XChaCha20-Poly1305',
          nonce: bytesToBase64(randomBytes(24)),
          ciphertext: bytesToBase64(randomBytes(48)),
        },
        createdAt: Date.now(),
      };

      expect(() => validateSpaceEnvelope(invalidEnv)).toThrow('Unsupported envelope version: expected 1, got 2');
    });

    it('should reject malformed JSON or truncated strings in parseEnvelope()', () => {
      expect(() => parseEnvelope('')).toThrow();
      expect(() => parseEnvelope('{ "spaceId": ')).toThrow();
      expect(() => parseEnvelope('random binary garbage string')).toThrow();
      expect(() => parseEnvelope('null')).toThrow();
    });

    it('should round-trip valid envelope through serialization and parsing', () => {
      const env = vault.createSpace({
        name: 'Valid Space',
        password: 'Password123',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const serialized = serializeEnvelope(env);
      const parsed = parseEnvelope(serialized);

      expect(parsed.spaceId).toBe(env.spaceId);
      expect(parsed.name).toBe(env.name);
      expect(parsed.kdfParams.salt).toBe(env.kdfParams.salt);
    });
  });

  describe('Cryptographic Envelope Tampering Tests', () => {
    let validEnv: SpaceHeaderEnvelope;

    beforeEach(() => {
      validEnv = vault.createSpace({
        name: 'Tamper Target',
        password: 'TargetPassword123!',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });
    });

    it('TAMPER TEST: Modifying ciphertext bit causes AEAD authentication rejection', () => {
      const cipherBytes = base64ToBytes(validEnv.encryptedMasterKey.ciphertext);
      cipherBytes[0] ^= 0x01; // Bit flip

      const tamperedEnv: SpaceHeaderEnvelope = {
        ...validEnv,
        encryptedMasterKey: {
          ...validEnv.encryptedMasterKey,
          ciphertext: bytesToBase64(cipherBytes),
        },
      };

      const freshVault = new SpaceVaultManager();
      freshVault.registerEnvelope(tamperedEnv);

      expect(() => freshVault.unlockSpace('TargetPassword123!')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
    });

    it('TAMPER TEST: Modifying nonce causes AEAD authentication rejection', () => {
      const nonceBytes = base64ToBytes(validEnv.encryptedMasterKey.nonce);
      nonceBytes[0] ^= 0xff; // Corrupt nonce

      const tamperedEnv: SpaceHeaderEnvelope = {
        ...validEnv,
        encryptedMasterKey: {
          ...validEnv.encryptedMasterKey,
          nonce: bytesToBase64(nonceBytes),
        },
      };

      const freshVault = new SpaceVaultManager();
      freshVault.registerEnvelope(tamperedEnv);

      expect(() => freshVault.unlockSpace('TargetPassword123!')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
    });

    it('TAMPER TEST: Modifying salt causes KDF derivation mismatch and unlock rejection', () => {
      const saltBytes = base64ToBytes(validEnv.kdfParams.salt);
      saltBytes[5] ^= 0xaa; // Corrupt salt

      const tamperedEnv: SpaceHeaderEnvelope = {
        ...validEnv,
        kdfParams: {
          ...validEnv.kdfParams,
          salt: bytesToBase64(saltBytes),
        },
      };

      const freshVault = new SpaceVaultManager();
      freshVault.registerEnvelope(tamperedEnv);

      expect(() => freshVault.unlockSpace('TargetPassword123!')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
    });

    it('TAMPER TEST: Modifying KDF parameters causes derivation mismatch and unlock rejection', () => {
      const tamperedEnv: SpaceHeaderEnvelope = {
        ...validEnv,
        kdfParams: {
          ...validEnv.kdfParams,
          timeCost: validEnv.kdfParams.timeCost + 1, // Alter iteration count
        },
      };

      const freshVault = new SpaceVaultManager();
      freshVault.registerEnvelope(tamperedEnv);

      expect(() => freshVault.unlockSpace('TargetPassword123!')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
    });
  });
});
