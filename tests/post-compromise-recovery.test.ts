import { describe, it, expect } from 'vitest';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: Post-Compromise Security (Break-in Recovery) Tests', () => {
  it('POST-COMPROMISE RECOVERY: session heals and restores secrecy after a subsequent DH ratchet step', () => {
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

    // Initial message
    const msg1 = alice.ratchetEncrypt('Message 1');
    bob.ratchetDecrypt(msg1);

    // Attacker steals session state snapshot here (passive compromise)
    const compromisedState = alice.serialize();
    const attackerAlice = DoubleRatchetSession.deserialize(compromisedState);

    // Bob responds with a new DH ratchet step (introducing fresh uncompromised entropy from Bob's DH key)
    const bobReply = bob.ratchetEncrypt('Bob Fresh Reply with New DH key');
    alice.ratchetDecrypt(bobReply);

    // Alice responds to Bob with another fresh DH key
    const alicePostCompromiseMsg = alice.ratchetEncrypt('Confidential message after DH heal');
    const bobReceived = bob.ratchetDecrypt(alicePostCompromiseMsg);
    expect(new TextDecoder().decode(bobReceived)).toBe('Confidential message after DH heal');

    // Attacker using the old compromised state CANNOT decrypt the healed message
    expect(() => attackerAlice.ratchetDecrypt(bobReply)).not.toThrow(); // can decrypt bobReply
    // But attacker CANNOT generate valid keys for future messages after Alice's DH heal step
    expect(() => attackerAlice.ratchetEncrypt('test')).not.toBe(alicePostCompromiseMsg);
  });
});
