import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { parseEnvelope, serializeEnvelope, validateSpaceEnvelope } from '../src/spaces/envelope.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToBase64, base64ToBytes, randomBytes } from '../src/crypto/utils.ts';
import type { SpaceHeaderEnvelope } from '../src/types/index.ts';


describe('VEIL Phase 1: Tampering, Corruption & AAD Adversarial Tests', () => {
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

  describe('AAD Context Binding & Transplantation Attack Tests', () => {
    it('AAD ATTACK: Transplanting encryptedMasterKey from Space A into Space B envelope must fail due to AAD mismatch', () => {
      const envA = vault.createSpace({
        name: 'Space A',
        password: 'IdenticalPassword123',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const envB = vault.createSpace({
        name: 'Space B',
        password: 'IdenticalPassword123',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      // Transplant Space A's ciphertext into Space B's envelope (same password, but different spaceId & salt in AAD)
      const transplantedEnv: SpaceHeaderEnvelope = {
        ...envB,
        encryptedMasterKey: {
          ...envA.encryptedMasterKey,
        },
      };

      const attackVault = new SpaceVaultManager();
      attackVault.registerEnvelope(transplantedEnv);

      // Attempt unlock -> MUST FAIL because AAD bound to Space A's ID and salt does not match Space B
      expect(() => attackVault.unlockSpace('IdenticalPassword123')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
    });

    it('AAD ATTACK: Altering spaceId in an otherwise valid envelope fails AAD verification', () => {
      const env = vault.createSpace({
        name: 'Space Original',
        password: 'Password123',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const alteredEnv: SpaceHeaderEnvelope = {
        ...env,
        spaceId: 'different-uuid-space-999',
      };

      const attackVault = new SpaceVaultManager();
      attackVault.registerEnvelope(alteredEnv);

      expect(() => attackVault.unlockSpace('Password123')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
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

    it('TAMPER TEST: Modifying salt causes KDF derivation and AAD mismatch', () => {
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
