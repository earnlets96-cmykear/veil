import { describe, it, expect } from 'vitest';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: Out-of-Order & Skipped Message Tests', () => {
  it('should decrypt messages arriving out-of-order (Message 1, Message 3, then Message 2)', () => {
    const sharedSecret = randomBytes(32);
    const bobRatchetKeypair = generateKeyAgreementKeypair(randomBytes(32));

    const alice = DoubleRatchetSession.initAlice(
      'sess-alice',
      'bob-id',
      'bob-sign-pub',
      'bob-ka-pub',
      sharedSecret,
      bobRatchetKeypair.publicKey
    );

    const bob = DoubleRatchetSession.initBob(
      'sess-bob',
      'alice-id',
      'alice-sign-pub',
      'alice-ka-pub',
      sharedSecret,
      bobRatchetKeypair
    );

    // Alice sends 3 consecutive messages
    const msg1 = alice.ratchetEncrypt('Message 1');
    const msg2 = alice.ratchetEncrypt('Message 2');
    const msg3 = alice.ratchetEncrypt('Message 3');

    // Bob receives Message 1
    expect(new TextDecoder().decode(bob.ratchetDecrypt(msg1))).toBe('Message 1');

    // Network delivers Message 3 BEFORE Message 2 (skipping Message 2)
    expect(new TextDecoder().decode(bob.ratchetDecrypt(msg3))).toBe('Message 3');

    // Network delayed Message 2 arrives later -> Bob decrypts using stored skipped key
    expect(new TextDecoder().decode(bob.ratchetDecrypt(msg2))).toBe('Message 2');
  });

  it('should delete skipped message key immediately after use (no reuse)', () => {
    const sharedSecret = randomBytes(32);
    const bobRatchetKeypair = generateKeyAgreementKeypair(randomBytes(32));

    const alice = DoubleRatchetSession.initAlice(
      'sess-alice',
      'bob-id',
      'bob-sign-pub',
      'bob-ka-pub',
      sharedSecret,
      bobRatchetKeypair.publicKey
    );

    const bob = DoubleRatchetSession.initBob(
      'sess-bob',
      'alice-id',
      'alice-sign-pub',
      'alice-ka-pub',
      sharedSecret,
      bobRatchetKeypair
    );

    const msg1 = alice.ratchetEncrypt('M1');
    const msg2 = alice.ratchetEncrypt('M2');

    // Receive M2 first (skipping M1)
    bob.ratchetDecrypt(msg2);

    // Decrypt skipped M1 once (succeeds and consumes key)
    expect(new TextDecoder().decode(bob.ratchetDecrypt(msg1))).toBe('M1');

    // Replaying M1 MUST fail because skipped message key was wiped and deleted
    expect(() => bob.ratchetDecrypt(msg1)).toThrow();
  });
});
