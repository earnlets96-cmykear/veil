/**
 * Neutral Lock Screen Component for VEIL.
 *
 * Implements credential-selected Space unlocking without revealing existing
 * Space names or counts before authentication.
 * 100% SVG vector iconography and accessibility.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { PasswordInput } from './ui/PasswordInput.tsx';
import { Button } from './ui/Button.tsx';
import {
  ShieldIcon,
  LockIcon,
  PlusIcon,
  RefreshCwIcon,
  AlertCircleIcon,
} from './icons/index.ts';

export const LockScreen: React.FC = () => {
  const { unlockSpace, openModal, panicLock, storageReady, storageError } = useApp();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      await unlockSpace(passphrase);
    } catch (_err: any) {
      setError('Invalid credentials or Space envelope not found.');
      setPassphrase('');
    } finally {
      setIsLoading(false);
    }
  };

  if (!storageReady) {
    if (storageError) {
      return (
        <div className="veil-modal-overlay" style={{ background: 'var(--veil-bg-base)' }}>
          <div className="veil-card" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertCircleIcon size={44} color="var(--veil-danger)" />
            </div>
            <h2 style={{ fontSize: 'var(--veil-text-xl)', marginBottom: '0.5rem' }}>Storage Unavailable</h2>
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1.25rem' }}>
              {storageError}
            </p>
            <Button variant="danger" onClick={() => window.location.reload()}>
              Retry Initialization
            </Button>
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
          color: '#f8fafc',
        }}
      >
        <div className="veil-card-glass" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--veil-radius-lg)',
              background: 'linear-gradient(135deg, var(--veil-accent-primary), #a855f7)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 24px var(--veil-accent-glow)',
              marginBottom: '1rem',
            }}
          >
            <ShieldIcon size={28} />
          </div>
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>Initializing VEIL</h2>
          <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)' }}>
            Securing isolated cryptographic partitions...
          </p>
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
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at top, #141b2d 0%, #090c13 100%)',
        padding: 'var(--veil-space-4)',
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
              color: '#ffffff',
              boxShadow: '0 0 24px var(--veil-accent-glow)',
              marginBottom: '1rem',
            }}
          >
            <ShieldIcon size={28} />
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
            <span className="veil-badge veil-badge-secure">End-to-End Encrypted</span>
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
            <PasswordInput
              id="passphrase-input"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={isLoading}
              autoFocus
              required
              aria-label="Space passphrase"
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
              role="alert"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={isLoading || !passphrase.trim()}
          >
            <LockIcon size={18} />
            <span>{isLoading ? 'Deriving Keys & Unlocking...' : 'Unlock Space'}</span>
          </Button>
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openModal({ type: 'createSpace' })}
          >
            <PlusIcon size={16} />
            <span>New Space</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openModal({ type: 'restoreAccount' })}
            title="Restore Account on Fresh Device"
          >
            <RefreshCwIcon size={16} />
            <span>Restore</span>
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={panicLock}
            title="Instant Memory Wipe"
          >
            <span>Panic</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
