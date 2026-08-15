/**
 * Human-Centered Security Indicators for VEIL Phase 7.
 *
 * Translates complex cryptographic guarantees into simple, actionable,
 * and intuitive user-facing indicators (Verified, Unverified, Security Changed).
 */

import type { SpaceSession } from '../spaces/session.ts';
import type { IdentityDocument } from '../identity/document.ts';
import type {
  VerificationStatus,
  SpaceSecuritySummary,
  IdentityChangeWarning,
  PrivacySettings,
} from './types.ts';

export class SecurityIndicators {
  /**
   * Translates verification flags into a simple conversation security status.
   */
  public static getConversationStatus(
    isVerified: boolean,
    hasKeyChanged: boolean
  ): { status: VerificationStatus; label: string; badge: string } {
    if (hasKeyChanged) {
      return {
        status: 'security_changed',
        label: 'Security Changed',
        badge: '⚠',
      };
    }
    if (isVerified) {
      return {
        status: 'verified',
        label: 'Verified',
        badge: '✓',
      };
    }
    return {
      status: 'unverified',
      label: 'Unverified',
      badge: '',
    };
  }

  /**
   * Generates a Space-level security overview for settings screens.
   */
  public static getSpaceSecuritySummary(
    session: SpaceSession,
    recoveryConfigured: boolean,
    enrolledDevicesCount: number,
    settings: PrivacySettings
  ): SpaceSecuritySummary {
    return {
      encrypted: true,
      recoveryStatus: recoveryConfigured ? 'configured' : 'not_configured',
      enrolledDevices: enrolledDevicesCount,
      autoLock: settings.autoLockInterval === 'off' ? 'Disabled' : settings.autoLockInterval,
      privacyLevel: settings.privacyLevel,
    };
  }

  /**
   * Produces a clear, actionable warning when a contact's cryptographic keys change.
   */
  public static formatIdentityChangeWarning(
    contactName: string,
    oldDoc: IdentityDocument,
    newDoc: IdentityDocument
  ): IdentityChangeWarning {
    let changeType: 'signing_key_changed' | 'key_agreement_changed' | 'full_identity_changed';

    if (oldDoc.signingPublicKey !== newDoc.signingPublicKey && oldDoc.keyAgreementPublicKey !== newDoc.keyAgreementPublicKey) {
      changeType = 'full_identity_changed';
    } else if (oldDoc.signingPublicKey !== newDoc.signingPublicKey) {
      changeType = 'signing_key_changed';
    } else {
      changeType = 'key_agreement_changed';
    }

    return {
      contactName,
      changeType,
      previousFingerprint: oldDoc.fingerprint,
      newFingerprint: newDoc.fingerprint,
      detectedAt: Date.now(),
      message: `Security information changed for ${contactName}. Their encryption keys have been updated. Verify safety numbers to ensure end-to-end encryption integrity.`,
    };
  }

  /**
   * Returns opt-in advanced security details for technical inspection.
   */
  public static formatSecurityDetails(
    session: SpaceSession,
    contactDoc?: IdentityDocument
  ): {
    protocol: string;
    encryption: string;
    identityFingerprint?: string;
    spaceName: string;
  } {
    return {
      protocol: 'VEIL End-to-End Encryption v1 (Double Ratchet / Sender Keys)',
      encryption: 'XChaCha20-Poly1305 + Ed25519 / X25519',
      identityFingerprint: contactDoc?.fingerprint,
      spaceName: session.name,
    };
  }
}
