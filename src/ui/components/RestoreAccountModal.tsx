/**
 * Restore Cloud Account Modal Component for VEIL.
 *
 * Implements zero-knowledge account restoration from cloud backup on fresh installs,
 * recovering the exact identical Space Master Key and Ed25519 identityId.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const RestoreAccountModal: React.FC = () => {
  const { restoreAccount, closeModal } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      await restoreAccount(username.trim().toLowerCase(), password);
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to restore account: invalid credentials or network error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="veil-modal-overlay">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Restore Account & Keys</h2>
          <button
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleRestore}>
          <div className="veil-modal-body">
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1rem' }}>
              Restores your zero-knowledge encrypted backup from the cloud server. Reconstructs your exact original cryptographic identity, Space Master Key, contacts, and sync state.
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
                Username
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="alice"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                Account Password
              </label>
              <input
                type="password"
                className="veil-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <button type="submit" className="veil-btn veil-btn-primary" disabled={isLoading || !username || !password}>
              {isLoading ? 'Deriving KEK & Restoring...' : 'Restore Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
