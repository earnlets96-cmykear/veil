/**
 * New Chat / Import Invitation Modal Component for VEIL Phase 15.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { InvitationManager } from '../../contacts/invitationManager.ts';

export const NewChatModal: React.FC = () => {
  const { addContactFromInvitation, addDirectContact, closeModal } = useApp();
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    setError(null);
    const raw = inputVal.trim();

    try {
      if (raw.startsWith('veil://invite/') || (raw.startsWith('{') && raw.includes('"signature"'))) {
        // Cryptographically signed invitation
        const invitation = InvitationManager.verifyAndParseInvitation(raw);
        await addContactFromInvitation(invitation);
      } else if (raw.startsWith('{')) {
        // Direct Identity Document
        const doc = JSON.parse(raw);
        await addDirectContact(doc);
      } else {
        // Simple Identity ID fallback
        const doc = {
          version: 1 as const,
          identityId: raw,
          signingPublicKey: 'dummy_sign_pub',
          keyAgreementPublicKey: 'dummy_ka_pub',
          fingerprint: raw.slice(0, 16).toUpperCase(),
          createdAt: Date.now(),
          signature: 'dummy_sig',
        };
        await addDirectContact(doc);

      }
    } catch (err: any) {
      setError(err.message || 'Invalid or tampered invitation.');
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="new-chat-title">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 id="new-chat-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Start Direct E2EE Chat</h2>
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleStartChat}>
          <div className="veil-modal-body">
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1rem' }}>
              Paste your peer's signed invitation link (<code>veil://invite/...</code>) or Identity Document.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="invitation-input"
                style={{
                  display: 'block',
                  fontSize: 'var(--veil-text-xs)',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Signed Invitation Link / Identity Payload
              </label>
              <textarea
                id="invitation-input"
                className="veil-input"
                style={{ minHeight: '100px', fontFamily: 'var(--veil-font-mono)', fontSize: 'var(--veil-text-xs)' }}
                placeholder="veil://invite/eyJ2ZXJzaW9uIjox... or Identity ID"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                required
                autoFocus
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid var(--veil-danger)',
                  borderRadius: 'var(--veil-radius-md)',
                  color: 'var(--veil-danger)',
                  fontSize: 'var(--veil-text-xs)',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div className="veil-modal-footer">
            <button type="button" className="veil-btn veil-btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="veil-btn veil-btn-primary" disabled={!inputVal.trim()}>
              Verify & Add Contact
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
