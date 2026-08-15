import { describe, it, expect } from 'vitest';
import {
  protectPayloadForTransport,
  unprotectTransportPayload,
} from '../src/transport/protection.ts';
import {
  createTransportEnvelope,
  validateTransportEnvelope,
} from '../src/transport/envelope.ts';
import { randomBytes, bytesToBase64, base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 3: Transport Tampering & Corruption Tests', () => {
  it('should detect tampered transport payload ciphertext (Poly1305 auth tag mismatch)', () => {
    const key = randomBytes(32);
    const plaintext = 'Secret message payload for Phase 3 test';

    const protectedData = protectPayloadForTransport(key, plaintext);

    // Tamper with a byte in the ciphertext
    const ctBytes = base64ToBytes(protectedData.ciphertext);
    ctBytes[5] ^= 0xFF;
    const tamperedCt = bytesToBase64(ctBytes);

    expect(() => {
      unprotectTransportPayload(key, protectedData.nonce, tamperedCt);
    }).toThrow(/Decryption failed/);
  });

  it('should detect tampered nonce in transport payload', () => {
    const key = randomBytes(32);
    const plaintext = 'Secret message payload';

    const protectedData = protectPayloadForTransport(key, plaintext);

    const nonceBytes = base64ToBytes(protectedData.nonce);
    nonceBytes[0] ^= 0x01;
    const tamperedNonce = bytesToBase64(nonceBytes);

    expect(() => {
      unprotectTransportPayload(key, tamperedNonce, protectedData.ciphertext);
    }).toThrow(/Decryption failed/);
  });

  it('should reject malformed or truncated transport envelopes', () => {
    const valid = createTransportEnvelope({
      mailboxId: 'mailbox123',
      payload: 'valid-payload',
      sizeClass: 'SMALL',
    });

    expect(validateTransportEnvelope(valid)).toBe(true);

    // Truncate payload
    const noPayload = { ...valid, payload: '' };
    expect(validateTransportEnvelope(noPayload)).toBe(false);

    // Invalid version
    const badVersion = { ...valid, version: 2 as any };
    expect(validateTransportEnvelope(badVersion)).toBe(false);

    // Invalid sizeClass
    const badSize = { ...valid, sizeClass: 'INVALID' as any };
    expect(validateTransportEnvelope(badSize)).toBe(false);
  });
});
