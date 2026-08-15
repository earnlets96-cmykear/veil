import { describe, it, expect } from 'vitest';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: Double Ratchet Core State Machine Tests', () => {
  it('should support bidirectional ping-pong messaging with DH ratcheting', () => {
    const sharedSecret = randomBytes(32);
    const bobRatchetKeypair = generateKeyAgreementKeypair(randomBytes(32));

    // Alice initializes with Bob's public ratchet key
    const alice = DoubleRatchetSession.initAlice(
      'sess-alice',
      'bob-id',
      'bob-sign-pub',
      'bob-ka-pub',
      sharedSecret,
      bobRatchetKeypair.publicKey
    );

    // Bob initializes with his ratchet keypair
    const bob = DoubleRatchetSession.initBob(
      'sess-bob',
      'alice-id',
      'alice-sign-pub',
      'alice-ka-pub',
      sharedSecret,
      bobRatchetKeypair
    );

    // 1. Alice -> Bob: Message 1
    const msg1 = alice.ratchetEncrypt('Hello Bob!');
    const decrypted1 = bob.ratchetDecrypt(msg1);
    expect(new TextDecoder().decode(decrypted1)).toBe('Hello Bob!');

    // 2. Alice -> Bob: Message 2 (Symmetric step on Alice sending chain)
    const msg2 = alice.ratchetEncrypt('How are you?');
    const decrypted2 = bob.ratchetDecrypt(msg2);
    expect(new TextDecoder().decode(decrypted2)).toBe('How are you?');

    // 3. Bob -> Alice: Message 3 (DH Ratchet step triggered by Bob reply)
    const msg3 = bob.ratchetEncrypt('Hey Alice, I am great!');
    const decrypted3 = alice.ratchetDecrypt(msg3);
    expect(new TextDecoder().decode(decrypted3)).toBe('Hey Alice, I am great!');

    // 4. Alice -> Bob: Message 4 (DH Ratchet step triggered by Alice reply)
    const msg4 = alice.ratchetEncrypt('Awesome to hear!');
    const decrypted4 = bob.ratchetDecrypt(msg4);
    expect(new TextDecoder().decode(decrypted4)).toBe('Awesome to hear!');
  });
});
