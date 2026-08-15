import { describe, it, expect } from 'vitest';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: Forward Secrecy Tests', () => {
  it('FORWARD SECRECY: compromising current session state cannot decrypt previously sent messages', () => {
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

    // Alice sends past message
    const pastMsg = alice.ratchetEncrypt('Top Secret Past Message');
    bob.ratchetDecrypt(pastMsg);

    // Several subsequent messages ratchet the keys forward (both DH and symmetric)
    for (let i = 0; i < 5; i++) {
      const ping = alice.ratchetEncrypt(`Ping ${i}`);
      bob.ratchetDecrypt(ping);
      const pong = bob.ratchetEncrypt(`Pong ${i}`);
      alice.ratchetDecrypt(pong);
    }

    // Attacker steals current state snapshot of Bob
    const bobCurrentState = bob.serialize();
    const clonedBob = DoubleRatchetSession.deserialize(bobCurrentState);

    // Cloned Bob cannot decrypt pastMsg because the past message key was discarded
    expect(() => clonedBob.ratchetDecrypt(pastMsg)).toThrow();
  });
});
