import { describe, it, expect } from 'vitest';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { randomBytes, base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: Ratchet Tampering & Authentication Tests', () => {
  it('HEADER TAMPERING: modifying sequenceNum fails AEAD authentication', () => {
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

    const msg = alice.ratchetEncrypt('Valid payload');

    // Tamper with sequenceNum in header
    const tamperedMsg = {
      ...msg,
      header: {
        ...msg.header,
        sequenceNum: msg.header.sequenceNum + 10,
      },
    };

    expect(() => bob.ratchetDecrypt(tamperedMsg)).toThrow(/Decryption failed/);
  });

  it('CIPHERTEXT TAMPERING: single bit flip in ciphertext fails authentication', () => {
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

    const msg = alice.ratchetEncrypt('Valid payload');

    const ctBytes = base64ToBytes(msg.ciphertext);
    ctBytes[0] ^= 0x01;
    const tamperedMsg = {
      ...msg,
      ciphertext: bytesToBase64(ctBytes),
    };

    expect(() => bob.ratchetDecrypt(tamperedMsg)).toThrow(/Decryption failed/);
  });
});
