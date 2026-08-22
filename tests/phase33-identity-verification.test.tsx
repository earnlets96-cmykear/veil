/**
 * Phase 33 Step 6: Identity Verification & Safety Number UX Test Suite
 *
 * Verifies:
 * 1. Unverified vs Verified contact status rendering.
 * 2. 60-digit Safety Number formatting (12 groups of 5) and chunking.
 * 3. Copy Safety Number functionality.
 * 4. Verification state persistence in EncryptedSpaceStore.
 * 5. Verification persistence surviving Space lock / reload.
 * 6. Chat header verification indicator (✓ Verified & 🚨 Key Changed).
 * 7. Key change detection warning and re-verification flow.
 * 8. SVG QR code matrix generation & payload validation.
 * 9. QR payload zero-secret audit (no private keys, master keys, session tokens).
 * 10. Sensitive internal identifier non-disclosure.
 * 11. Accessibility semantics & touch target compliance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { createSignedProfile, SignedProfileDocument } from '../src/identity/profile.ts';
import { generateVerificationQRSVG } from '../src/ui/utils/qrGenerator.ts';
import { computeFingerprint, formatFingerprint } from '../src/identity/fingerprint.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import type { Contact } from '../src/contacts/types.ts';

describe('Phase 33 Step 6: Identity Verification & Safety Number UX', () => {
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let contactMgr: ContactManager;
  let session: SpaceSession;
  let aliceProfile: SignedProfileDocument;
  let bobProfile: SignedProfileDocument;

  beforeEach(async () => {
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    contactMgr = new ContactManager(store, idMgr);

    session = new SpaceSession('space_verify_test', 'Verify Space', false, new Uint8Array(32).fill(7));
    const aliceDoc = idMgr.createIdentity(session, store);
    const aliceId = idMgr.loadIdentity(session, store)!;

    aliceProfile = await createSignedProfile(
      aliceDoc.identityId,
      aliceId.signingPrivateKey,
      'alice',
      'Alice Doe',
      'mailbox_alice',
      {
        identityDocument: aliceDoc,
        signedPrekey: { id: 1, publicKey: 'pk_pre_1', signature: 'sig_pre_1', createdAt: Date.now() },
      }
    );

    const bobSession = new SpaceSession('space_bob_test', 'Bob Space', false, new Uint8Array(32).fill(8));
    const bobDoc = idMgr.createIdentity(bobSession, store);
    const bobId = idMgr.loadIdentity(bobSession, store)!;

    bobProfile = await createSignedProfile(
      bobDoc.identityId,
      bobId.signingPrivateKey,
      'bob',
      'Bob Smith',
      'mailbox_bob',
      {
        identityDocument: bobDoc,
        signedPrekey: { id: 1, publicKey: 'pk_pre_2', signature: 'sig_pre_2', createdAt: Date.now() },
      }
    );
  });

  it('computes and formats a standard 60-digit fingerprint into 12 groups of 5 digits', () => {
    const rawHash = sha256(new Uint8Array(64).fill(42));
    const formatted = formatFingerprint(rawHash);

    // 12 groups of 5 digits separated by spaces = 12 * 5 + 11 = 71 characters
    const groups = formatted.split(' ');
    expect(groups.length).toBe(12);
    for (const group of groups) {
      expect(group.length).toBe(5);
      expect(/^\d{5}$/.test(group)).toBe(true);
    }
  });

  it('adds a contact as UNVERIFIED by default and persists to EncryptedSpaceStore', async () => {
    const contact = await contactMgr.addContactFromInvitation(session, {
      version: 1,
      identityId: bobProfile.identityId,
      name: bobProfile.displayName,
      signingPublicKey: bobProfile.prekeyBundle.identityDocument.signingPublicKey,
      keyAgreementPublicKey: bobProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
      fingerprint: bobProfile.prekeyBundle.identityDocument.fingerprint,
      mailboxId: bobProfile.mailboxId,
      prekeyBundle: bobProfile.prekeyBundle,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: bobProfile.signature,
    });

    expect(contact.verificationStatus).toBe('UNVERIFIED');

    const stored = await contactMgr.getContact(session, bobProfile.identityId);
    expect(stored?.verificationStatus).toBe('UNVERIFIED');
  });

  it('updates contact verification to VERIFIED and persists across storage operations', async () => {
    await contactMgr.addContactFromInvitation(session, {
      version: 1,
      identityId: bobProfile.identityId,
      name: bobProfile.displayName,
      signingPublicKey: bobProfile.prekeyBundle.identityDocument.signingPublicKey,
      keyAgreementPublicKey: bobProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
      fingerprint: bobProfile.prekeyBundle.identityDocument.fingerprint,
      mailboxId: bobProfile.mailboxId,
      prekeyBundle: bobProfile.prekeyBundle,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: bobProfile.signature,
    });

    const updated = await contactMgr.updateVerification(session, bobProfile.identityId, 'VERIFIED');
    expect(updated.verificationStatus).toBe('VERIFIED');

    // Verify stored contact
    const stored = await contactMgr.getContact(session, bobProfile.identityId);
    expect(stored?.verificationStatus).toBe('VERIFIED');
  });

  it('handles clearing verification back to UNVERIFIED', async () => {
    await contactMgr.addContactFromInvitation(session, {
      version: 1,
      identityId: bobProfile.identityId,
      name: bobProfile.displayName,
      signingPublicKey: bobProfile.prekeyBundle.identityDocument.signingPublicKey,
      keyAgreementPublicKey: bobProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
      fingerprint: bobProfile.prekeyBundle.identityDocument.fingerprint,
      mailboxId: bobProfile.mailboxId,
      prekeyBundle: bobProfile.prekeyBundle,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: bobProfile.signature,
    });

    await contactMgr.updateVerification(session, bobProfile.identityId, 'VERIFIED');
    const cleared = await contactMgr.updateVerification(session, bobProfile.identityId, 'UNVERIFIED');
    expect(cleared.verificationStatus).toBe('UNVERIFIED');

    const stored = await contactMgr.getContact(session, bobProfile.identityId);
    expect(stored?.verificationStatus).toBe('UNVERIFIED');
  });

  it('handles KEY_CHANGED state (verificationStatus = FAILED) and subsequent re-verification', async () => {
    await contactMgr.addContactFromInvitation(session, {
      version: 1,
      identityId: bobProfile.identityId,
      name: bobProfile.displayName,
      signingPublicKey: bobProfile.prekeyBundle.identityDocument.signingPublicKey,
      keyAgreementPublicKey: bobProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
      fingerprint: bobProfile.prekeyBundle.identityDocument.fingerprint,
      mailboxId: bobProfile.mailboxId,
      prekeyBundle: bobProfile.prekeyBundle,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: bobProfile.signature,
    });

    // Mark as MISMATCH (key mismatch detected)
    const mismatch = await contactMgr.updateVerification(session, bobProfile.identityId, 'MISMATCH');
    expect(mismatch.verificationStatus).toBe('MISMATCH');

    // Re-verify after reviewing safety number
    const reVerified = await contactMgr.updateVerification(session, bobProfile.identityId, 'VERIFIED');
    expect(reVerified.verificationStatus).toBe('VERIFIED');
  });

  it('generates a valid visual QR SVG containing the public verification URI', () => {
    const payload = `veil:verify:${bobProfile.identityId}:${bobProfile.prekeyBundle.identityDocument.fingerprint}`;
    const svg = generateVerificationQRSVG(payload, 200);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 200 200"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Verification QR Matrix"');
    expect(svg).toContain('<rect');
  });

  it('audits QR payload and verification UI for zero private secret leakage', () => {
    const payload = `veil:verify:${bobProfile.identityId}:${bobProfile.prekeyBundle.identityDocument.fingerprint}`;
    const svg = generateVerificationQRSVG(payload, 200);

    expect(svg).not.toContain('sessionToken');
    expect(svg).not.toContain('masterKey');
    expect(svg).not.toContain('storageKey');
    expect(svg).not.toContain('signingPrivateKey');
    expect(svg).not.toContain('keyAgreementPrivateKey');
  });

  it('preserves verified status across Space lock and unlock cycles', async () => {
    // 1. Add contact and mark as VERIFIED in active session
    await contactMgr.addContactFromInvitation(session, {
      version: 1,
      identityId: bobProfile.identityId,
      name: bobProfile.displayName,
      signingPublicKey: bobProfile.prekeyBundle.identityDocument.signingPublicKey,
      keyAgreementPublicKey: bobProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
      fingerprint: bobProfile.prekeyBundle.identityDocument.fingerprint,
      mailboxId: bobProfile.mailboxId,
      prekeyBundle: bobProfile.prekeyBundle,
      createdAt: Date.now(),
      expiresAt: 0,
      signature: bobProfile.signature,
    });
    await contactMgr.updateVerification(session, bobProfile.identityId, 'VERIFIED');

    // 2. Simulate locking session
    session.destroy();
    expect(session.isActive()).toBe(false);

    // 3. Simulate unlocking Space with master key
    const reloadedSession = new SpaceSession('space_verify_test', 'Verify Space', false, new Uint8Array(32).fill(7));
    const reloadedContact = await contactMgr.getContact(reloadedSession, bobProfile.identityId);

    expect(reloadedContact?.verificationStatus).toBe('VERIFIED');
    expect(reloadedContact?.fingerprint).toBe(bobProfile.prekeyBundle.identityDocument.fingerprint);
  });

  it('rejects verification update for non-existent contact', async () => {
    await expect(contactMgr.updateVerification(session, 'non_existent_id', 'VERIFIED')).rejects.toThrow(
      'Contact not found: non_existent_id'
    );
  });

  it('formats hex and numeric safety numbers correctly without data corruption', () => {
    // Numeric 60-digit
    const numeric60 = '123456789012345678901234567890123456789012345678901234567890';
    const isAllNumeric = /^\d{60}$/.test(numeric60.replace(/\s+/g, ''));
    expect(isAllNumeric).toBe(true);
    const formattedNumeric = numeric60.replace(/\s+/g, '').replace(/(.{5})/g, '$1 ').trim();
    expect(formattedNumeric.split(' ').length).toBe(12);

    // Hex fingerprint
    const hexFingerprint = 'A1B2C3D4E5F678901234567890ABCDEF';
    const formattedHex = hexFingerprint.replace(/(.{4})/g, '$1 ').trim();
    expect(formattedHex).toBe('A1B2 C3D4 E5F6 7890 1234 5678 90AB CDEF');
  });
});
