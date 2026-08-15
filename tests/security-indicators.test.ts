import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SecurityIndicators } from '../src/privacy/securityIndicators.ts';
import { PrivacyManager } from '../src/privacy/privacyManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import type { IdentityDocument } from '../src/identity/document.ts';

describe('VEIL Phase 7: Human-Centered Security Indicators Tests', () => {
  let vault: SpaceVaultManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
  });

  it('SECURITY INDICATORS: Translates verification and key changes into clear UI indicators', () => {
    // 1. Unverified contact
    const unverified = SecurityIndicators.getConversationStatus(false, false);
    expect(unverified.status).toBe('unverified');
    expect(unverified.label).toBe('Unverified');

    // 2. Verified contact
    const verified = SecurityIndicators.getConversationStatus(true, false);
    expect(verified.status).toBe('verified');
    expect(verified.label).toBe('Verified');
    expect(verified.badge).toBe('✓');

    // 3. Contact key changed
    const keyChanged = SecurityIndicators.getConversationStatus(true, true);
    expect(keyChanged.status).toBe('security_changed');
    expect(keyChanged.label).toBe('Security Changed');
    expect(keyChanged.badge).toBe('⚠');
  });

  it('IDENTITY CHANGE WARNING: Generates clear warning message when contact keys change', () => {
    const docOld: IdentityDocument = {
      version: 1,
      identityId: 'id_old',
      signingPublicKey: 'pub_sign_old',
      keyAgreementPublicKey: 'pub_ka_old',
      fingerprint: '12345 67890',
      createdAt: 1000,
      signature: 'sig_old',
    };

    const docNew: IdentityDocument = {
      version: 1,
      identityId: 'id_new',
      signingPublicKey: 'pub_sign_new',
      keyAgreementPublicKey: 'pub_ka_new',
      fingerprint: '99999 00000',
      createdAt: 2000,
      signature: 'sig_new',
    };

    const warning = SecurityIndicators.formatIdentityChangeWarning('Alice', docOld, docNew);
    expect(warning.contactName).toBe('Alice');
    expect(warning.changeType).toBe('full_identity_changed');
    expect(warning.previousFingerprint).toBe('12345 67890');
    expect(warning.newFingerprint).toBe('99999 00000');
    expect(warning.message).toContain('Security information changed for Alice');
  });

  it('SPACE SUMMARY: Generates high-level space security overview', () => {
    const header = vault.createSpace({ name: 'Work', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = vault.unlockSpace('Pass', header.spaceId);

    const summary = SecurityIndicators.getSpaceSecuritySummary(sess, true, 2, PrivacyManager.getDefaultSettings());
    expect(summary.encrypted).toBe(true);
    expect(summary.recoveryStatus).toBe('configured');
    expect(summary.enrolledDevices).toBe(2);
    expect(summary.autoLock).toBe('5min');
  });
});
