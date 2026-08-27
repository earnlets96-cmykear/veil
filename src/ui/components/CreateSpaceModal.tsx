/**
 * Create Space Modal Component for VEIL.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { Button, IconButton, PasswordInput } from './ui/index.ts';
import { CloseIcon, PlusIcon } from './icons/index.ts';

export const CreateSpaceModal: React.FC = () => {
  const { createSpace, closeModal } = useApp();
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !passphrase.trim() || isLoading) return;

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
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-space-title">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 id="create-space-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Create Isolated Space</h2>
          <IconButton icon={<CloseIcon size={18} />} aria-label="Close dialog" onClick={closeModal} />
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
              <PasswordInput
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
              <PasswordInput
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
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          <div className="veil-modal-footer">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading || !name || !passphrase} loading={isLoading}>
              <PlusIcon size={16} />
              <span>{isLoading ? 'Creating Envelope...' : 'Create Space'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
