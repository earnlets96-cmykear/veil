/**
 * Create Space Modal Component for VEIL.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const CreateSpaceModal: React.FC = () => {
  const { createSpace, closeModal } = useApp();
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !passphrase.trim()) return;

    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await createSpace(name.trim(), passphrase);
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create Space.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="veil-modal-overlay">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Create Isolated Space</h2>
          <button
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div className="veil-modal-body">
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1rem' }}>
              Each Space derives completely independent keys and storage partitions.
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
                Space Name (e.g. Personal, Work, Private)
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="Personal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

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
                Space Passphrase
              </label>
              <input
                type="password"
                className="veil-input"
                placeholder="••••••••••••"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
              />
            </div>

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
                Confirm Passphrase
              </label>
              <input
                type="password"
                className="veil-input"
                placeholder="••••••••••••"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                required
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
            <button type="button" className="veil-btn veil-btn-secondary" onClick={closeModal} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="veil-btn veil-btn-primary" disabled={isLoading || !name || !passphrase}>
              {isLoading ? 'Creating Envelope...' : 'Create Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
