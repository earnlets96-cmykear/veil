import { describe, it, expect } from 'vitest';
import { computeFingerprint, computeIdentityId, formatFingerprint } from '../src/identity/fingerprint.ts';
import { canonicalizeIdentity, canonicalizeIdentityString } from '../src/identity/canonical.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

describe('VEIL Phase 2: Identity Fingerprint & Canonical Serialization', () => {
  describe('Fingerprint', () => {
    it('should be deterministic — same keys produce same fingerprint', () => {
      const sigPub = randomBytes(32);
      const kaPub = randomBytes(32);

      const fp1 = computeFingerprint(sigPub, kaPub);
      const fp2 = computeFingerprint(sigPub, kaPub);

      expect(fp1).toBe(fp2);
    });

    it('should produce different fingerprints for different keys', () => {
      const fp1 = computeFingerprint(randomBytes(32), randomBytes(32));
      const fp2 = computeFingerprint(randomBytes(32), randomBytes(32));

      expect(fp1).not.toBe(fp2);
    });

    it('should format as 12 groups of 5 digits', () => {
      const fp = computeFingerprint(randomBytes(32), randomBytes(32));
      const groups = fp.split(' ');
      expect(groups.length).toBe(12);
      for (const g of groups) {
        expect(g.length).toBe(5);
        expect(/^\d{5}$/.test(g)).toBe(true);
      }
    });

    it('should reject invalid key lengths', () => {
      expect(() => computeFingerprint(new Uint8Array(16), randomBytes(32))).toThrow(/expected 32 bytes/);
      expect(() => computeFingerprint(randomBytes(32), new Uint8Array(16))).toThrow(/expected 32 bytes/);
    });
  });

  describe('Identity ID', () => {
    it('should be deterministic hex(SHA-256(sigPub || kaPub))', () => {
      const sigPub = randomBytes(32);
      const kaPub = randomBytes(32);

      const id1 = computeIdentityId(sigPub, kaPub);
      const id2 = computeIdentityId(sigPub, kaPub);

      expect(id1).toBe(id2);
      expect(id1.length).toBe(64); // 32 bytes hex = 64 chars
      expect(/^[0-9a-f]{64}$/.test(id1)).toBe(true);
    });

    it('should produce different IDs for different keys', () => {
      const id1 = computeIdentityId(randomBytes(32), randomBytes(32));
      const id2 = computeIdentityId(randomBytes(32), randomBytes(32));
      expect(id1).not.toBe(id2);
    });
  });

  describe('Canonical Serialization', () => {
    it('should produce identical bytes for identical inputs regardless of call order', () => {
      const fields = {
        version: 1 as const,
        identityId: 'abc123',
        signingPublicKey: 'AAAA',
        keyAgreementPublicKey: 'BBBB',
        fingerprint: '12345 67890 12345 67890 12345 67890 12345 67890 12345 67890 12345 67890',
        createdAt: 1000000,
      };

      const bytes1 = canonicalizeIdentity(fields);
      const bytes2 = canonicalizeIdentity(fields);

      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true);
    });

    it('should produce valid JSON that can be parsed', () => {
      const fields = {
        version: 1 as const,
        identityId: 'test-id',
        signingPublicKey: 'sigKey',
        keyAgreementPublicKey: 'kaKey',
        fingerprint: '00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000',
        createdAt: 999,
      };

      const str = canonicalizeIdentityString(fields);
      const parsed = JSON.parse(str);

      expect(parsed.version).toBe(1);
      expect(parsed.identityId).toBe('test-id');
      expect(parsed.signingPublicKey).toBe('sigKey');
      expect(parsed.keyAgreementPublicKey).toBe('kaKey');
      expect(parsed.createdAt).toBe(999);
    });

    it('should NOT contain whitespace or newlines', () => {
      const fields = {
        version: 1 as const,
        identityId: 'id',
        signingPublicKey: 'sig',
        keyAgreementPublicKey: 'ka',
        fingerprint: 'fp',
        createdAt: 1,
      };

      const str = canonicalizeIdentityString(fields);
      expect(str).not.toMatch(/\s(?!.*")/); // no whitespace outside quotes
      expect(str).not.toContain('\n');
      expect(str).not.toContain('\t');
    });
  });
});
