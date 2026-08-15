import { describe, it, expect } from 'vitest';
import { zeroize, withSecureBuffer } from '../src/crypto/memory.ts';
import {
  randomBytes,
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
  hexToBytes,
  constantTimeEquals,
} from '../src/crypto/utils.ts';
import type { SpaceHeaderEnvelope, SpaceIdentity } from '../src/types/index.ts';

describe('VEIL Phase 0: Cryptographic Foundation & Memory Hygiene', () => {
  describe('Memory Zeroization', () => {
    it('should overwrite sensitive buffer with zeros', () => {
      const secret = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(secret.some(b => b !== 0)).toBe(true);

      zeroize(secret);

      expect(secret.every(b => b === 0)).toBe(true);
      expect(secret.length).toBe(8);
    });

    it('should handle null, undefined, or empty buffers gracefully', () => {
      expect(() => zeroize(null)).not.toThrow();
      expect(() => zeroize(undefined)).not.toThrow();
      expect(() => zeroize(new Uint8Array(0))).not.toThrow();
    });

    it('should automatically zeroize buffer within withSecureBuffer', () => {
      let capturedBuffer: Uint8Array | null = null;

      const result = withSecureBuffer(32, buf => {
        capturedBuffer = buf;
        buf[0] = 0xaa;
        buf[31] = 0xbb;
        return 'operation-completed';
      });

      expect(result).toBe('operation-completed');
      expect(capturedBuffer).not.toBeNull();
      // Should be zeroized after block exit
      expect(capturedBuffer!.every(b => b === 0)).toBe(true);
    });
  });

  describe('Random Byte Generation (CSPRNG)', () => {
    it('should generate buffers of requested length', () => {
      const bytes16 = randomBytes(16);
      const bytes32 = randomBytes(32);
      expect(bytes16.length).toBe(16);
      expect(bytes32.length).toBe(32);
    });

    it('should produce distinct random samples', () => {
      const a = randomBytes(32);
      const b = randomBytes(32);
      expect(constantTimeEquals(a, b)).toBe(false);
    });
  });

  describe('Encoding Utilities', () => {
    it('should round-trip binary data through Base64', () => {
      const original = randomBytes(64);
      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);

      expect(constantTimeEquals(original, decoded)).toBe(true);
    });

    it('should round-trip binary data through Hex', () => {
      const original = randomBytes(32);
      const hex = bytesToHex(original);
      expect(hex.length).toBe(64);

      const decoded = hexToBytes(hex);
      expect(constantTimeEquals(original, decoded)).toBe(true);
    });
  });

  describe('Constant-Time Equality', () => {
    it('should return true for identical byte arrays', () => {
      const a = new Uint8Array([10, 20, 30, 40]);
      const b = new Uint8Array([10, 20, 30, 40]);
      expect(constantTimeEquals(a, b)).toBe(true);
    });

    it('should return false for differing byte arrays', () => {
      const a = new Uint8Array([10, 20, 30, 40]);
      const b = new Uint8Array([10, 20, 30, 41]);
      expect(constantTimeEquals(a, b)).toBe(false);
    });

    it('should return false for different length arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);
      expect(constantTimeEquals(a, b)).toBe(false);
    });
  });

  describe('Type Invariants & Space Schema Specifications', () => {
    it('should validate standard SpaceHeaderEnvelope structure', () => {
      const envelope: SpaceHeaderEnvelope = {
        spaceId: 'space-test-uuid-1',
        version: 1,
        name: 'Main Space',
        isDecoy: false,
        kdfParams: {
          algorithm: 'argon2id',
          salt: bytesToBase64(randomBytes(32)),
          timeCost: 3,
          memoryCost: 65536,
          parallelism: 1,
          keyLength: 32,
        },
        encryptedMasterKey: {
          algorithm: 'XChaCha20-Poly1305',
          nonce: bytesToBase64(randomBytes(24)),
          ciphertext: bytesToBase64(randomBytes(48)), // 32 bytes SMK + 16 bytes tag
        },
        createdAt: Date.now(),
      };

      expect(envelope.version).toBe(1);
      expect(envelope.kdfParams.algorithm).toBe('argon2id');
      expect(envelope.kdfParams.memoryCost).toBe(65536);
      expect(envelope.kdfParams.timeCost).toBe(3);
    });

    it('should validate SpaceIdentity schema', () => {
      const identity: SpaceIdentity = {
        spaceId: 'space-test-uuid-2',
        identityKeyPub: bytesToBase64(randomBytes(32)),
        identityKeyPriv: bytesToBase64(randomBytes(32)),
        signingKeyPub: bytesToBase64(randomBytes(32)),
        signingKeyPriv: bytesToBase64(randomBytes(32)),
        displayName: 'Alice',
        createdAt: Date.now(),
      };

      expect(identity.displayName).toBe('Alice');
      expect(identity.spaceId).toBe('space-test-uuid-2');
    });
  });
});
