import { describe, it, expect } from 'vitest';
import { DeviceEnrollmentManager } from '../src/device/enrollment.ts';
import { x25519 } from '@noble/curves/ed25519.js';

describe('VEIL Phase 6: MITM Attack Detection via Short Authentication String (SAS)', () => {
  it('MITM ATTACK: Attacker key substitution causes SAS code mismatch', () => {
    // 1. Primary device generates ephemeral keypair
    const primaryPriv = x25519.utils.randomPrivateKey();
    const primaryPub = x25519.getPublicKey(primaryPriv);

    // 2. Secondary device generates ephemeral keypair
    const secondaryPriv = x25519.utils.randomPrivateKey();
    const secondaryPub = x25519.getPublicKey(secondaryPriv);

    // 3. Active MITM Attacker Eve intercepts and substitutes her own ephemeral keys
    const evePriv1 = x25519.utils.randomPrivateKey();
    const evePub1 = x25519.getPublicKey(evePriv1);

    const evePriv2 = x25519.utils.randomPrivateKey();
    const evePub2 = x25519.getPublicKey(evePriv2);

    // Primary computes shared secret with Eve's key instead of Secondary's key
    const primarySharedSecret = x25519.getSharedSecret(primaryPriv, evePub1);
    const primarySAS = DeviceEnrollmentManager.computeSAS(primarySharedSecret, primaryPub, evePub1);

    // Secondary computes shared secret with Eve's other key instead of Primary's key
    const secondarySharedSecret = x25519.getSharedSecret(secondaryPriv, evePub2);
    const secondarySAS = DeviceEnrollmentManager.computeSAS(secondarySharedSecret, evePub2, secondaryPub);

    // 4. Primary and Secondary SAS codes MUST MISMATCH
    expect(primarySAS).not.toBe(secondarySAS);
  });
});
