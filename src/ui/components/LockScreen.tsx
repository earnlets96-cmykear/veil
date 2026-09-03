/**
 * VEIL Restrained Production Lock & Authentication Screen.
 *
 * Implements credential-selected Space unlocking without revealing existing
 * Space names or counts before authentication.
 *
 * Features:
 * - 100% SVG vector iconography and accessible form controls.
 * - Sub-100ms instant loading feedback with progressive state updates.
 * - Zero decorative clutter, glows, or AI-style radial gradients.
 * - Local-first encryption reassurance with zero secret leakage.
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../app/AppState.tsx';
import { PasswordInput } from './ui/PasswordInput.tsx';
import { Button } from './ui/Button.tsx';
import { Spinner } from './ui/Spinner.tsx';
import {
  LockIcon,
  ShieldIcon,
  PlusIcon,
  RefreshCwIcon,
  AlertCircleIcon,
} from './icons/index.ts';

export const LockScreen: React.FC = () => {
  const { unlockSpace, openModal, panicLock, storageReady, storageError } = useApp();
  const [username, setUsername] = useState(() => {
    try {
      return (typeof localStorage !== 'undefined' ? localStorage.getItem('veil:last_username') : null) || '';
    } catch (_e) {
      return '';
    }
  });
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'deriving' | 'loading_data'>('idle');

  // Progressive status message transitions while unlocking
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loadingPhase === 'deriving') {
      timer = setTimeout(() => {
        setLoadingPhase('loading_data');
      }, 400);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loadingPhase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setError('Please enter your account username.');
      return;
    }
    if (!passphrase.trim() || loadingPhase !== 'idle') return;

    setError(null);
    setLoadingPhase('deriving');

    try {
      await unlockSpace(passphrase, cleanUsername);
    } catch (err: any) {
      setError(err?.message || 'Invalid username or passphrase.');
      setPassphrase('');
      setLoadingPhase('idle');
    }
  };

  if (!storageReady) {
    if (storageError) {
      return (
        <div className="veil-modal-overlay" style={{ background: 'var(--veil-bg-base)' }}>
          <div className="veil-card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertCircleIcon size={36} color="var(--veil-danger)" />
            </div>
            <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
              Storage Unavailable
            </h2>
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1.25rem' }}>
              {storageError}
            </p>
            <Button variant="danger" onClick={() => window.location.reload()} fullWidth>
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
          backgroundColor: 'var(--veil-bg-base)',
          color: 'var(--veil-text-primary)',
        }}
      >
        <div className="veil-card" style={{ width: '90%', maxWidth: '380px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <Spinner size="md" />
          </div>
          <h2 style={{ fontSize: 'var(--veil-text-base)', fontWeight: 600, marginBottom: '0.25rem' }}>
            Initializing VEIL
          </h2>
          <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-xs)' }}>
            Securing isolated cryptographic partitions...
          </p>
        </div>
      </div>
    );
  }

  const isLoading = loadingPhase !== 'idle';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: 'var(--veil-bg-base)',
        padding: 'var(--veil-space-4)',
      }}
    >
      <div
        className="veil-card"
        style={{
          width: '100%',
          maxWidth: '390px',
          padding: '2rem',
          boxShadow: 'var(--veil-elevation-2)',
          borderColor: 'var(--veil-border)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--veil-radius-md)',
              backgroundColor: 'var(--veil-accent-primary-subtle)',
              border: '1px solid var(--veil-accent-primary-alpha)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--veil-accent-primary)',
              marginBottom: '0.85rem',
            }}
          >
            <ShieldIcon size={22} />
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--veil-text-primary)',
              lineHeight: 1.2,
            }}
          >
            VEIL
          </h1>
          <p
            style={{
              color: 'var(--veil-text-secondary)',
              fontSize: 'var(--veil-text-xs)',
              marginTop: '0.35rem',
            }}
          >
            Unlock your encrypted Space
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="username-input"
              style={{
                display: 'block',
                fontSize: 'var(--veil-text-xs)',
                fontWeight: 600,
                color: 'var(--veil-text-secondary)',
                marginBottom: '0.5rem',
                letterSpacing: '0.03em',
              }}
            >
              Account Username
            </label>
            <input
              id="username-input"
              type="text"
              className="veil-input"
              placeholder="e.g. dagmawi"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoFocus
              required
              aria-label="Account username"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="passphrase-input"
              style={{
                display: 'block',
                fontSize: 'var(--veil-text-xs)',
                fontWeight: 600,
                color: 'var(--veil-text-secondary)',
                marginBottom: '0.5rem',
                letterSpacing: '0.03em',
              }}
            >
              Enter Space Passphrase / PIN
            </label>
            <PasswordInput
              id="passphrase-input"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={isLoading}
              required
              aria-label="Space passphrase"
            />
          </div>

          {error && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--veil-danger-bg)',
                border: '1px solid var(--veil-danger-border)',
                borderRadius: 'var(--veil-radius-sm)',
                color: 'var(--veil-danger)',
                fontSize: 'var(--veil-text-xs)',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.25rem',
              }}
              role="alert"
            >
              <AlertCircleIcon size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
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
            {isLoading ? (
              <span>
                {loadingPhase === 'deriving'
                  ? 'Deriving Keys...'
                  : 'Preparing Secure Space...'}
              </span>
            ) : (
              <>
                <LockIcon size={17} />
                <span>Unlock Space</span>
              </>
            )}
          </Button>
        </form>

        {/* Secondary Actions */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--veil-divider)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openModal({ type: 'createSpace' })}
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.4rem 0.6rem' }}
          >
            <PlusIcon size={14} />
            <span>New Space</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openModal({ type: 'restoreAccount' })}
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.4rem 0.6rem' }}
            title="Restore Account on Fresh Device"
          >
            <RefreshCwIcon size={14} />
            <span>Restore</span>
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={panicLock}
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.4rem 0.6rem' }}
            title="Instant Memory Wipe"
          >
            <span>Panic</span>
          </Button>
        </div>

        {/* Local Security Assurance */}
        <div
          style={{
            marginTop: '1.25rem',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--veil-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <LockIcon size={12} color="var(--veil-text-muted)" />
          <span>Locally encrypted with Argon2id &amp; XChaCha20</span>
        </div>
      </div>
    </div>
  );
};
