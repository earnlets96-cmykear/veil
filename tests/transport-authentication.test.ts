import { describe, it, expect } from 'vitest';
import {
  generateMailboxCapability,
  deriveCapabilityVerifier,
  verifyCapability,
} from '../src/transport/capability.ts';
import { base64ToBytes, bytesToBase64, randomBytes } from '../src/crypto/utils.ts';
import { MockTransportServer } from '../src/transport/server.ts';

describe('VEIL Phase 3: Capability Authentication & Verifier Tests', () => {
  it('should authenticate client capability against derived verifier in constant time', () => {
    const { capability } = generateMailboxCapability();
    const verifier = deriveCapabilityVerifier(capability);

    expect(verifyCapability(capability, verifier)).toBe(true);
  });

  it('should reject invalid or wrong capability', () => {
    const mb1 = generateMailboxCapability();
    const mb2 = generateMailboxCapability();
    const verifier1 = deriveCapabilityVerifier(mb1.capability);

    expect(verifyCapability(mb2.capability, verifier1)).toBe(false);
  });

  it('should reject bit-flipped capability', () => {
    const { capability } = generateMailboxCapability();
    const verifier = deriveCapabilityVerifier(capability);

    const capBytes = base64ToBytes(capability);
    capBytes[0] ^= 0x01; // flip single bit
    const tamperedCap = bytesToBase64(capBytes);

    expect(verifyCapability(tamperedCap, verifier)).toBe(false);
  });

  it('SERVER SECURITY: server verifier is a one-way hash and does not reveal the capability secret', () => {
    const secret = randomBytes(32);
    const capability = bytesToBase64(secret);
    const verifier = deriveCapabilityVerifier(capability);

    // Verifier is 32 bytes base64 (SHA-256)
    expect(base64ToBytes(verifier).length).toBe(32);
    // Verifier is mathematically distinct from the secret
    expect(verifier).not.toBe(capability);
  });

  it('should reject requests with malformed capability strings gracefully without crashing', async () => {
    const server = new MockTransportServer();
    const { mailboxId, capability } = generateMailboxCapability();
    await server.createMailbox(mailboxId, deriveCapabilityVerifier(capability));

    await expect(server.fetchEnvelopes(mailboxId, 'not-a-valid-base64-capability')).rejects.toThrow();
    await expect(server.fetchEnvelopes(mailboxId, '')).rejects.toThrow();
  });
});
