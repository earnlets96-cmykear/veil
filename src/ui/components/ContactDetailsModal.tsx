/**
 * Dedicated Identity Verification & Safety Number Modal for VEIL Phase 33 Step 6.
 *
 * Provides human-verifiable cryptographic identity verification:
 * - Formatted 60-digit Safety Number (12 groups of 5) or chunked fingerprint
 * - High-contrast visual QR verification matrix
 * - Verification status toggle (Unverified, Verified, Key Changed)
 * - Space-isolated persistence via EncryptedSpaceStore
 * - Accessible keyboard navigation & mobile touch targets
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { generateVerificationQRSVG } from '../utils/qrGenerator.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  StatusIndicator,
  useToast,
} from './ui/index.ts';

interface ContactDetailsModalProps {
  conversationId: string;
}

export const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({ conversationId }) => {
  const {
    conversations,
    contacts,
    closeModal,
    updateContactVerification,
  } = useApp();

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'numeric' | 'qr'>('numeric');
  const [copiedSafetyNumber, setCopiedSafetyNumber] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const conv = conversations.find((c) => c.id === conversationId);
  const contact = contacts.find((c) => c.identityId === conversationId);

  const displayName = contact?.name || conv?.name || 'Contact';
  const rawFingerprint = contact?.fingerprint || conv?.fingerprint || conversationId.slice(0, 16).toUpperCase();
  const verificationStatus = contact?.verificationStatus || (conv?.isVerified ? 'VERIFIED' : 'UNVERIFIED');

  // Format fingerprint into 12 groups of 5 digits or readable 4-char chunks
  const isAllNumeric = /^\d{60}$/.test(rawFingerprint.replace(/\s+/g, ''));
  const formattedSafetyNumber = isAllNumeric
    ? rawFingerprint.replace(/\s+/g, '').replace(/(.{5})/g, '$1 ').trim()
    : rawFingerprint.replace(/(.{4})/g, '$1 ').trim();

  // Generate QR SVG payload
  const qrPayload = `veil:verify:${conversationId}:${rawFingerprint}`;
  const qrSvg = generateVerificationQRSVG(qrPayload, 180);

  const handleCopySafetyNumber = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(rawFingerprint);
      setCopiedSafetyNumber(true);
      showToast({ type: 'success', message: 'Safety number copied to clipboard' });
      setTimeout(() => setCopiedSafetyNumber(false), 3000);
    }
  };

  const handleToggleVerification = async () => {
    setIsUpdating(true);
    try {
      const nextStatus = verificationStatus === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED';
      await updateContactVerification(conversationId, nextStatus);
      showToast({
        type: nextStatus === 'VERIFIED' ? 'success' : 'info',
        message: nextStatus === 'VERIFIED' ? `Marked ${displayName} as verified` : 'Verification cleared',
      });
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to update verification status' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReverifyKeyChanged = async () => {
    setIsUpdating(true);
    try {
      await updateContactVerification(conversationId, 'VERIFIED');
      showToast({
        type: 'success',
        message: `Acknowledged and verified new identity for ${displayName}`,
      });
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to re-verify identity' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="verify-modal-title">
      <div className="veil-modal-card" style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className="veil-modal-header">
          <h2 id="verify-modal-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>
            Verify Identity
          </h2>
          <IconButton icon="✕" aria-label="Close verification modal" onClick={closeModal} />
        </div>

        <div className="veil-modal-body">
          {/* Key Changed Alert */}
          {verificationStatus === 'FAILED' && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--veil-danger)',
                borderRadius: 'var(--veil-radius-md)',
                color: 'var(--veil-danger)',
                fontSize: 'var(--veil-text-xs)',
                marginBottom: '1rem',
                lineHeight: 1.4,
              }}
              role="alert"
            >
              <strong>🚨 Identity Mismatch Warning:</strong>
              <div style={{ marginTop: '0.25rem' }}>
                This contact's cryptographic identity key has changed since your last verification. Compare the safety number below through a trusted second channel before accepting.
              </div>
            </div>
          )}

          {/* Contact Identity Summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Avatar name={displayName} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--veil-text-base)', color: 'var(--veil-text-primary)' }}>
                {displayName}
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                {verificationStatus === 'VERIFIED' ? (
                  <Badge variant="secure">✓ Verified Safety Number</Badge>
                ) : verificationStatus === 'FAILED' ? (
                  <Badge variant="danger">🚨 Key Changed</Badge>
                ) : (
                  <Badge variant="warning">⚠️ Not Verified</Badge>
                )}
              </div>
            </div>
          </div>

          <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-xs)', lineHeight: 1.5, marginBottom: '1rem' }}>
            To verify end-to-end encryption authenticity, compare this safety number with <strong>{displayName}</strong> in person or over an end-to-end encrypted video/voice call.
          </p>

          {/* View Mode Tabs (Numeric vs QR) */}
          <div className="veil-sidebar-tabs" style={{ marginBottom: '1rem' }} role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'numeric'}
              className={`veil-tab-btn ${activeTab === 'numeric' ? 'active' : ''}`}
              onClick={() => setActiveTab('numeric')}
            >
              123 Safety Number
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'qr'}
              className={`veil-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
              onClick={() => setActiveTab('qr')}
            >
              ▦ QR Code
            </button>
          </div>

          {/* Tab 1: Numeric Safety Number View */}
          {activeTab === 'numeric' ? (
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--veil-bg-base)',
                border: '1px solid var(--veil-border)',
                borderRadius: 'var(--veil-radius-md)',
                textAlign: 'center',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cryptographic Safety Number
                </span>
                <button
                  type="button"
                  onClick={handleCopySafetyNumber}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--veil-accent-secondary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {copiedSafetyNumber ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>

              <div
                style={{
                  fontFamily: 'var(--veil-font-mono)',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: 'var(--veil-text-primary)',
                  lineHeight: 1.8,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {formattedSafetyNumber}
              </div>
            </div>
          ) : (
            /* Tab 2: Visual QR Code Matrix View */
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--veil-border)',
                borderRadius: 'var(--veil-radius-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                marginBottom: '1rem',
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Cryptographic Verification QR Code"
              />
              <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#444444', textAlign: 'center' }}>
                Scan or compare this visual verification code on your contact's device.
              </div>
            </div>
          )}

          {/* Contextual Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.25rem' }}>
            {verificationStatus === 'FAILED' ? (
              <Button
                variant="danger"
                style={{ width: '100%' }}
                onClick={handleReverifyKeyChanged}
                disabled={isUpdating}
              >
                Acknowledge & Re-verify New Identity
              </Button>
            ) : (
              <Button
                variant={verificationStatus === 'VERIFIED' ? 'secondary' : 'primary'}
                style={{ width: '100%' }}
                onClick={handleToggleVerification}
                disabled={isUpdating}
              >
                {verificationStatus === 'VERIFIED' ? '✕ Clear Verification' : '✓ Mark Identity as Verified'}
              </Button>
            )}

            <Button variant="secondary" style={{ width: '100%' }} onClick={closeModal}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
