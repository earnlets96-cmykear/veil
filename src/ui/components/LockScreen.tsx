/**
 * VEIL Clean Authentication Screen (First Login & Account Sign In).
 *
 * Designed as a modern, privacy-first authentication interface:
 * - Tabbed switcher between "Sign In" and "Create Account".
 * - Username & Password credentials with show/hide password visibility.
 * - Zero disclosure: no account counts, no space enumerations, no leaks.
 * - Local-first reassurance with Argon2id + XChaCha20 cryptography under the hood.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { PasswordInput } from './ui/PasswordInput.tsx';
import { Button } from './ui/Button.tsx';
import { ShieldIcon, AlertCircleIcon, UserIcon, LockIcon } from './icons/index.ts';

interface LockScreenProps {
  onSuccessAuth?: (params: {
    spaceId: string;
    username: string;
    spaceName: string;
    password?: string;
  }) => void;
  onCancelPasswordFallback?: () => void;
  showCancel?: boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  onSuccessAuth,
  onCancelPasswordFallback,
  showCancel,
}) => {
  const { unlockSpace, createSpace, storageReady, storageError } = useApp();
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [username, setUsername] = useState(() => {
    try {
      return (typeof localStorage !== 'undefined' ? localStorage.getItem('veil:last_username') : null) || '';
    } catch (_e) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [spaceName, setSpaceName] = useState('Main Space');
  const [error, setError] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'deriving' | 'authenticating'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setError('Please enter your username.');
      return;
    }
    if (!password.trim() || loadingPhase !== 'idle') return;

    setError(null);
    setLoadingPhase('deriving');

    try {
      if (mode === 'signin') {
        await unlockSpace(password, cleanUsername);
        if (onSuccessAuth) {
          onSuccessAuth({
            spaceId: '',
            username: cleanUsername,
            spaceName: 'Main Space',
            password,
          });
        }
      } else {
        await createSpace(spaceName.trim() || 'Main Space', password, cleanUsername);
        if (onSuccessAuth) {
          onSuccessAuth({
            spaceId: '',
            username: cleanUsername,
            spaceName: spaceName.trim() || 'Main Space',
            password,
          });
        }
      }
    } catch (err: any) {
      setError(err?.message || (mode === 'signin' ? 'Invalid username or password.' : 'Failed to create account.'));
      setPassword('');
      setLoadingPhase('idle');
    }
  };

  if (!storageReady) {
    if (storageError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100vw',
            backgroundColor: 'var(--veil-bg-base)',
            color: 'var(--veil-text-primary)',
            padding: '1rem',
          }}
        >
          <div className="veil-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
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
          minHeight: '100vh',
          width: '100vw',
          backgroundColor: 'var(--veil-bg-base)',
          color: 'var(--veil-text-primary)',
        }}
      >
        <div className="veil-card" style={{ width: '90%', maxWidth: '360px', padding: '2rem', textAlign: 'center' }}>
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
        padding: '1rem',
        userSelect: 'none',
      }}
    >
      <div
        className="veil-card"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '2.25rem 1.75rem',
          backgroundColor: 'var(--veil-bg-surface)',
          borderColor: 'var(--veil-border)',
          borderRadius: 'var(--veil-radius-xl)',
          boxShadow: 'var(--veil-elevation-3)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--veil-radius-lg)',
              backgroundColor: 'var(--veil-accent-primary-subtle)',
              border: '1px solid var(--veil-accent-primary-alpha)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--veil-accent-primary)',
              marginBottom: '0.75rem',
            }}
          >
            <ShieldIcon size={24} />
          </div>
          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--veil-text-primary)',
              margin: '0 0 0.35rem 0',
            }}
          >
            VEIL
          </h1>
          <p
            style={{
              color: 'var(--veil-text-secondary)',
              fontSize: 'var(--veil-text-xs)',
              margin: 0,
            }}
          >
            {mode === 'signin' ? 'Sign in to your account' : 'Create a new encrypted account'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--veil-bg-surface-elevated)',
            borderRadius: 'var(--veil-radius-md)',
            padding: '4px',
            marginBottom: '1.25rem',
            border: '1px solid var(--veil-border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '6px 0',
              border: 'none',
              borderRadius: 'var(--veil-radius-sm)',
              fontSize: 'var(--veil-text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'signin' ? 'var(--veil-accent-primary)' : 'transparent',
              color: mode === 'signin' ? '#ffffff' : 'var(--veil-text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '6px 0',
              border: 'none',
              borderRadius: 'var(--veil-radius-sm)',
              fontSize: 'var(--veil-text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'create' ? 'var(--veil-accent-primary)' : 'transparent',
              color: mode === 'create' ? '#ffffff' : 'var(--veil-text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Create Account
          </button>
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
                marginBottom: '0.4rem',
              }}
            >
              Username
            </label>
            <input
              id="username-input"
              type="text"
              className="veil-input"
              placeholder="e.g. alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoFocus
              required
              style={{ width: '100%' }}
            />
          </div>

          {mode === 'create' && (
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="space-name-input"
                style={{
                  display: 'block',
                  fontSize: 'var(--veil-text-xs)',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Space Name
              </label>
              <input
                id="space-name-input"
                type="text"
                className="veil-input"
                placeholder="e.g. Main Space, Work, Private"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                disabled={isLoading}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="password-input"
              style={{
                display: 'block',
                fontSize: 'var(--veil-text-xs)',
                fontWeight: 600,
                color: 'var(--veil-text-secondary)',
                marginBottom: '0.4rem',
              }}
            >
              Password
            </label>
            <PasswordInput
              id="password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Space Passphrase"
              disabled={isLoading}
              required
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
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : mode === 'signin' ? (
              <span>Unlock Space</span>
            ) : (
              <span>Create Account</span>
            )}
          </Button>

          {showCancel && onCancelPasswordFallback && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              onClick={onCancelPasswordFallback}
              style={{ marginTop: '0.75rem', fontSize: 'var(--veil-text-xs)' }}
            >
              Back to PIN Lock
            </Button>
          )}
        </form>

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
