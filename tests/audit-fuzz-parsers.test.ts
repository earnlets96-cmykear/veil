import { describe, it, expect } from 'vitest';
import { MessagePadding } from '../src/privacy/padding.ts';
import { validateTransportEnvelope } from '../src/transport/envelope.ts';
import { RecoveryVault } from '../src/recovery/recoveryVault.ts';
import { getRandomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 9 Red-Team Audit: Hostile Parser Fuzzing', () => {
  it('FUZZING MESSAGE PADDING: Handles 500 malformed, random, and edge-case buffers without crashing', () => {
    // 1. Edge-case buffers
    expect(() => MessagePadding.unpadMessage(new Uint8Array(0))).toThrow();
    expect(() => MessagePadding.unpadMessage(new Uint8Array(1))).toThrow();

    // 2. 500 random byte arrays of varying lengths
    for (let i = 0; i < 500; i++) {
      const len = Math.floor(Math.random() * 1000);
      const randomBuf = getRandomBytes(len);

      try {
        MessagePadding.unpadMessage(randomBuf);
      } catch (err) {
        // Expected safe rejection
        expect(err).toBeInstanceOf(Error);
      }
    }
  });

  it('FUZZING TRANSPORT ENVELOPE: Validates hostile envelope inputs safely', () => {
    expect(validateTransportEnvelope(null as any)).toBe(false);
    expect(validateTransportEnvelope({} as any)).toBe(false);
    expect(validateTransportEnvelope({ version: 2 } as any)).toBe(false);
    expect(validateTransportEnvelope({ version: 1, sizeClass: 'INVALID' } as any)).toBe(false);
  });

  it('FUZZING BACKUP PARSER: Rejects random byte blobs cleanly', () => {
    for (let i = 0; i < 50; i++) {
      const randomBuf = getRandomBytes(128);
      expect(() => RecoveryVault.importEncryptedBackupFile(randomBuf, 'pass')).toThrow();
    }
  });
});
