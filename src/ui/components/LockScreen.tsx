/**
 * Neutral Lock Screen Component for VEIL.
 *
 * Implements credential-selected Space unlocking without revealing existing
 * Space names or counts before authentication.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const LockScreen: React.FC = () => {
  const { unlockSpace, openModal, panicLock, storageReady, storageError, knownSpacesCount } = useApp();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      await unlockSpace(passphrase);
    } catch (err: any) {
      setError('Invalid credentials or Space envelope not found.');
      setPassphrase('');
    } finally {
      setIsLoading(false);
    }
  };

  if (!storageReady) {
    return (
      <div className="veil-modal-overlay" style={{ background: 'var(--veil-bg-base)' }}>
        <div className="veil-card" style={{ maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: 'var(--veil-text-xl)', marginBottom: '0.5rem' }}>Storage Unavailable</h2>
          <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1rem' }}>
            {storageError || 'Persistent IndexedDB storage could not be initialized. VEIL has failed closed for security.'}
          </p>
          <button className="veil-btn veil-btn-danger" onClick={() => window.location.reload()}>
            Retry Initialization
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at top, #141b2d 0%, #090c13 100%)',
      }}
    >
      <div className="veil-card-glass" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--veil-radius-lg)',
              background: 'linear-gradient(135deg, var(--veil-accent-primary), #a855f7)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              color: '#ffffff',
              boxShadow: '0 0 24px var(--veil-accent-glow)',
              marginBottom: '1rem',
            }}
          >
            🛡️
          </div>
          <h1
            style={{
              fontSize: 'var(--veil-text-2xl)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #f8fafc 0%, #a855f7 50%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            VEIL
          </h1>
          <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginTop: '0.25rem' }}>
            Privacy-First Multi-Space Messenger
          </p>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="veil-badge veil-badge-secure">Release Candidate v1.0.0-rc.1</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="passphrase-input"
              style={{
                display: 'block',
                fontSize: 'var(--veil-text-xs)',
                fontWeight: 600,
                color: 'var(--veil-text-secondary)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Enter Space Passphrase / PIN
            </label>
            <input
              id="passphrase-input"
              type="password"
              className="veil-input"
              placeholder="••••••••••••"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={isLoading}
              autoFocus
              required
            />
          </div>

          {error && (
            <div
              style={{
                padding: '0.65rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid var(--veil-danger)',
                borderRadius: 'var(--veil-radius-md)',
                color: 'var(--veil-danger)',
                fontSize: 'var(--veil-text-xs)',
                textAlign: 'center',
                marginBottom: '1.25rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="veil-btn veil-btn-primary"
            style={{ width: '100%', padding: '0.75rem', fontSize: 'var(--veil-text-base)' }}
            disabled={isLoading || !passphrase.trim()}
          >
            {isLoading ? 'Deriving Keys & Unlocking...' : 'Unlock Space'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--veil-border-subtle)',
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ fontSize: 'var(--veil-text-xs)' }}
            onClick={() => openModal({ type: 'createSpace' })}
          >
            + New Space
          </button>

          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ fontSize: 'var(--veil-text-xs)' }}
            onClick={() => openModal({ type: 'restoreAccount' })}
            title="Restore Account on Fresh Device"
          >
            🔄 Restore Account
          </button>

          <button
            type="button"
            className="veil-btn veil-btn-panic"
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.4rem 0.6rem' }}
            onClick={panicLock}
            title="Instant Memory Wipe"
          >
            🚨 Panic
          </button>
        </div>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
          {knownSpacesCount} encrypted vault envelope(s) at rest
        </div>
      </div>
    </div>
  );
};
