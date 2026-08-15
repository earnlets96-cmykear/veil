import { describe, it, expect } from 'vitest';
import { DisclosureGuard, GENERIC_UNLOCK_ERROR } from '../src/privacy/disclosureGuard.ts';

describe('VEIL Phase 7: Error Disclosure & Marketing Guard Tests', () => {
  it('ERROR SANITIZATION: Collapses credential/space/decryption errors to generic unlock error', () => {
    expect(DisclosureGuard.sanitizeError(new Error('Invalid password for Private Space'))).toBe(GENERIC_UNLOCK_ERROR);
    expect(DisclosureGuard.sanitizeError(new Error('Argon2id KEK mismatch for envelope'))).toBe(GENERIC_UNLOCK_ERROR);
    expect(DisclosureGuard.sanitizeError(new Error('XChaCha20Poly1305 AEAD decryption tag mismatch'))).toBe(GENERIC_UNLOCK_ERROR);
    expect(DisclosureGuard.sanitizeError(new Error('Space f47ac10b not found in database'))).toBe(GENERIC_UNLOCK_ERROR);
  });

  it('MARKETING GUARD: Rejects prohibited security theater and false claims', () => {
    expect(DisclosureGuard.validateUserFacingText('VEIL uses military-grade encryption').isValid).toBe(false);
    expect(DisclosureGuard.validateUserFacingText('100% anonymous messenger').isValid).toBe(false);
    expect(DisclosureGuard.validateUserFacingText('Unhackable secret space').isValid).toBe(false);
    expect(DisclosureGuard.validateUserFacingText('Forensic-proof plausible deniability').isValid).toBe(false);

    // Valid privacy statements
    expect(DisclosureGuard.validateUserFacingText('End-to-end encrypted messaging with Double Ratchet').isValid).toBe(true);
    expect(DisclosureGuard.validateUserFacingText('Your conversations are protected by XChaCha20-Poly1305').isValid).toBe(true);
  });
});
