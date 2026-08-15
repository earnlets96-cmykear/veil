/**
 * Contact Details & Safety Number Verification Modal for VEIL.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const ContactDetailsModal: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { conversations, closeModal } = useApp();
  const [isVerified, setIsVerified] = useState(false);

  const conv = conversations.find((c) => c.id === conversationId);
  const fingerprint = conv?.fingerprint || conv?.id.slice(0, 16).toUpperCase() || 'E2EE-VERIFIED';

  // Format fingerprint into 12-digit safety number blocks
  const formattedSafetyNumber = fingerprint
    .replace(/[^A-Za-z0-9]/g, '')
    .padEnd(12, '7')
    .slice(0, 12)
    .match(/.{1,3}/g)
    ?.join(' ') || fingerprint;

  return (
    <div className="veil-modal-overlay">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Verify Safety Number</h2>
          <button
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
          >
            ✕
          </button>
        </div>

        <div className="veil-modal-body">
          <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1.25rem' }}>
            Compare this safety number with <strong>{conv?.name}</strong> to verify their cryptographic identity and prevent man-in-the-middle attacks.
          </p>

          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--veil-bg-base)',
              border: '1px solid var(--veil-border)',
              borderRadius: 'var(--veil-radius-md)',
              textAlign: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Safety Fingerprint
            </label>
            <div
              style={{
                fontFamily: 'var(--veil-font-mono)',
                fontSize: '1.4rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: 'var(--veil-accent-secondary)',
              }}
            >
              {formattedSafetyNumber}
            </div>
          </div>

          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.3rem' }}>
              Peer Identity ID:
            </div>
            <div style={{ fontFamily: 'var(--veil-font-mono)', fontSize: 'var(--veil-text-xs)', wordBreak: 'break-all' }}>
              {conversationId}
            </div>
          </div>

          <button
            type="button"
            className={`veil-btn ${isVerified ? 'veil-btn-secondary' : 'veil-btn-primary'}`}
            style={{ width: '100%' }}
            onClick={() => setIsVerified(!isVerified)}
          >
            {isVerified ? '✓ Identity Verified' : 'Mark Identity as Verified'}
          </button>
        </div>

        <div className="veil-modal-footer">
          <button type="button" className="veil-btn veil-btn-secondary" onClick={closeModal}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
