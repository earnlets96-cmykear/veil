import { describe, it, expect } from 'vitest';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { bytesToBase64, randomBytes } from '../src/crypto/utils.ts';
import { IdentityDocument } from '../src/identity/document.ts';

describe('VEIL Phase 15: Cryptographic Invitation Protocol Tests', () => {
  it('INVITATION LIFECYCLE: Generates, encodes, decodes and verifies valid signed invitation', () => {
    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));

    const doc: IdentityDocument = {
      version: 1,
      identityId: 'id_alice_invitation',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'ALICE-FP-888',
      createdAt: Date.now(),
      signature: 'sig',
    };

    const inv = InvitationManager.createInvitation(doc, signKp.privateKey, 'Alice');
    const shareable = InvitationManager.toShareableString(inv);
    expect(shareable).toMatch(/^veil:\/\/invite\//);

    const parsed = InvitationManager.verifyAndParseInvitation(shareable);
    expect(parsed.identityId).toBe('id_alice_invitation');
    expect(parsed.name).toBe('Alice');
    expect(parsed.fingerprint).toBe('ALICE-FP-888');
  });

  it('TAMPER REJECTION: Modified invitation payload fails signature verification', () => {
    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));

    const doc: IdentityDocument = {
      version: 1,
      identityId: 'id_bob_tamper',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'BOB-FP-111',
      createdAt: Date.now(),
      signature: 'sig',
    };

    const inv = InvitationManager.createInvitation(doc, signKp.privateKey, 'Bob');
    const tampered = { ...inv, name: 'Mallory' };
    const tamperedStr = JSON.stringify(tampered);

    expect(() => {
      InvitationManager.verifyAndParseInvitation(tamperedStr);
    }).toThrow(/Invalid invitation signature: potential forgery/);
  });

  it('EXPIRATION REJECTION: Expired invitation is rejected', () => {
    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));

    const doc: IdentityDocument = {
      version: 1,
      identityId: 'id_expired',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'EXPIRED-FP',
      createdAt: Date.now() - 10000,
      signature: 'sig',
    };

    const inv = InvitationManager.createInvitation(doc, signKp.privateKey, 'OldUser', -1000);
    const jsonStr = JSON.stringify(inv);

    expect(() => {
      InvitationManager.verifyAndParseInvitation(jsonStr);
    }).toThrow(/Invitation has expired/);
  });
});
