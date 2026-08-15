import { describe, it, expect } from 'vitest';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 20: Cross-Platform Protocol Interoperability Tests', () => {
  it('WIRE COMPATIBILITY: Message encrypted by Android persona is seamlessly decrypted by Web persona', () => {
    const sharedSecret = randomBytes(32);
    const bobRatchetKeypair = generateKeyAgreementKeypair(randomBytes(32));

    // Client A (Android) initializes Alice ratchet
    const alice = DoubleRatchetSession.initAlice(
      'sess-android',
      'web-id',
      'web-sign-pub',
      'web-ka-pub',
      sharedSecret,
      bobRatchetKeypair.publicKey
    );

    // Client B (Web Desktop) initializes Bob ratchet
    const bob = DoubleRatchetSession.initBob(
      'sess-web',
      'android-id',
      'android-sign-pub',
      'android-ka-pub',
      sharedSecret,
      bobRatchetKeypair
    );

    const msg = 'Cross-platform verification payload from Android';
    const encrypted = alice.ratchetEncrypt(msg);

    // Web decrypts
    const decrypted = bob.ratchetDecrypt(encrypted);
    expect(new TextDecoder().decode(decrypted)).toBe(msg);
  });
});
