import { describe, it, expect } from 'vitest';
import { generateMailboxId, generateCapability } from '../src/transport/capability.ts';
import { getRandomBytes, bytesToHex } from '../src/crypto/utils.ts';

describe('VEIL Phase 8: Identifier Privacy & Anti-Correlation Tests', () => {
  it('IDENTIFIER PRIVACY: Identifiers are high-entropy, opaque, and non-sequential', () => {
    // 1. Generate 10 mailbox IDs
    const mailboxes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const mbId = generateMailboxId();
      expect(mbId).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex
      expect(mbId).not.toContain('user');
      expect(mbId).not.toContain('space');
      expect(mbId).not.toContain('admin');
      mailboxes.add(mbId);
    }
    expect(mailboxes.size).toBe(10);

    // 2. Generate capabilities
    const cap1 = generateCapability();
    const cap2 = generateCapability();
    expect(cap1.capability).not.toBe(cap2.capability);
    expect(cap1.verifier).not.toBe(cap2.verifier);
  });
});
