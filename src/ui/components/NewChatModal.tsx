/**
 * New Chat Modal Component for VEIL.
 *
 * Allows initiating a 1-to-1 conversation via peer Identity Document or Identity ID.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const NewChatModal: React.FC = () => {
  const { addDirectContact, closeModal } = useApp();
  const [identityInput, setIdentityInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityInput.trim()) return;

    setError(null);
    try {
      let doc: any;
      if (identityInput.trim().startsWith('{')) {
        doc = JSON.parse(identityInput.trim());
      } else {
        // Simple manual identity ID
        doc = {
          identityId: identityInput.trim(),
          signingPublicKey: 'dummy_sign_pub',
          keyAgreementPublicKey: 'dummy_ka_pub',
          fingerprint: identityInput.trim().slice(0, 16).toUpperCase(),
        };
      }

      await addDirectContact(doc);
    } catch (err: any) {
      setError(err.message || 'Invalid identity document.');
    }
  };

  return (
    <div className="veil-modal-overlay">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Start Direct E2EE Chat</h2>
          <button
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleStartChat}>
          <div className="veil-modal-body">
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1rem' }}>
              Paste your peer's public Identity ID or Identity Document to initiate an end-to-end encrypted session.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--veil-text-xs)',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Peer Identity ID / Document
              </label>
              <textarea
                className="veil-input"
                style={{ minHeight: '100px', fontFamily: 'var(--veil-font-mono)', fontSize: 'var(--veil-text-xs)' }}
                placeholder="e.g. 8f4b2a1c... or JSON Identity Document"
                value={identityInput}
                onChange={(e) => setIdentityInput(e.target.value)}
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
            <button type="submit" className="veil-btn veil-btn-primary" disabled={!identityInput.trim()}>
              Start Conversation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
