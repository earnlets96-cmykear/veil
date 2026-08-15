import { describe, it, expect } from 'vitest';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { randomBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { IdentityDocument } from '../src/identity/document.ts';

describe('VEIL Phase 21: Invitation Deep-Link Routing & Validation', () => {
  it('DEEP LINK PARSING: Parses valid veil://invite/... URI and verifies signature', () => {
    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));

    const doc: IdentityDocument = {
      version: 1,
      identityId: 'id_alice_test',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'FP-ALICE-123',
      createdAt: Date.now(),
      signature: 'sig',
    };

    const inv = InvitationManager.createInvitation(doc, signKp.privateKey, 'Alice In Wonderland');
    const uri = InvitationManager.toShareableString(inv);

    expect(uri.startsWith('veil://invite/')).toBe(true);

    const parsed = InvitationManager.verifyAndParseInvitation(uri);
    expect(parsed.name).toBe('Alice In Wonderland');
    expect(parsed.identityId).toBe('id_alice_test');
    expect(parsed.fingerprint).toBe('FP-ALICE-123');
  });
});
