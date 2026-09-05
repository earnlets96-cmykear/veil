import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { PasswordInput } from './ui/PasswordInput.tsx';
import { Button } from './ui/Button.tsx';
import { ShieldCheckIcon, AlertCircleIcon, UserIcon, LockIcon, LayersIcon } from './icons/index.ts';

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
            backgroundColor: 'var(--veil-bg-base, #080b11)',
            color: 'var(--veil-text-primary, #f3f4f6)',
            padding: '1.5rem',
          }}
        >
          <div
            className="veil-card"
            style={{
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center',
              backgroundColor: '#0f141d',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '2rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertCircleIcon size={36} color="var(--veil-danger, #ef4444)" />
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Storage Unavailable
            </h2>
            <p style={{ color: 'var(--veil-text-secondary, #94a3b8)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
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
          backgroundColor: 'var(--veil-bg-base, #080b11)',
          color: 'var(--veil-text-primary, #f3f4f6)',
        }}
      >
        <div
          className="veil-card"
          style={{
            width: '90%',
            maxWidth: '360px',
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#0f141d',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              margin: '0 auto 1rem auto',
              backgroundColor: 'rgba(20, 184, 166, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#14b8a6',
            }}
          >
            <ShieldCheckIcon size={26} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            Initializing VEIL
          </h2>
          <p style={{ color: 'var(--veil-text-secondary, #94a3b8)', fontSize: '0.8rem', margin: 0 }}>
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: 'var(--veil-bg-base, #080b11)',
        padding: '1.5rem 1rem',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '390px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Brand Shield Logo with glowing badge */}
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '20px',
            backgroundColor: 'rgba(20, 184, 166, 0.12)',
            border: '1.5px solid rgba(20, 184, 166, 0.35)',
            boxShadow: '0 0 32px rgba(20, 184, 166, 0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#14b8a6',
            marginBottom: '1rem',
          }}
        >
          <ShieldCheckIcon size={36} />
        </div>

        {/* Brand Title and Tagline */}
        <h1
          style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: '#ffffff',
            margin: '0 0 0.25rem 0',
          }}
        >
          VEIL
        </h1>
        <p
          style={{
            color: '#14b8a6',
            fontSize: '0.825rem',
            fontWeight: 500,
            letterSpacing: '0.02em',
            margin: '0 0 1.75rem 0',
          }}
        >
          Private. Secure. Yours.
        </p>

        {/* Main Card Container */}
        <div
          style={{
            width: '100%',
            backgroundColor: '#0f141d',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '1.75rem 1.5rem',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.35rem' }}>
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#f3f4f6',
                margin: '0 0 0.35rem 0',
              }}
            >
              {mode === 'signin' ? 'Sign in to your account' : 'Create a new encrypted account'}
            </h2>
            <p
              style={{
                color: 'var(--veil-text-secondary, #94a3b8)',
                fontSize: '0.775rem',
                margin: 0,
              }}
            >
              {mode === 'signin'
                ? 'Enter your credentials to unlock your space'
                : 'Your credentials derive your isolated cryptographic key'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="username-input"
                style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary, #94a3b8)',
                  marginBottom: '0.4rem',
                }}
              >
                Username
              </label>
              <div style={{ position: 'relative' }}>
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
                  style={{
                    width: '100%',
                    backgroundColor: '#161d29',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 0.85rem 0.75rem 2.4rem',
                    color: '#f3f4f6',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--veil-text-secondary, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <UserIcon size={16} />
                </div>
              </div>
            </div>

            {/* Space Name Input (Create Mode Only) */}
            {mode === 'create' && (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="space-name-input"
                  style={{
                    display: 'block',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    color: 'var(--veil-text-secondary, #94a3b8)',
                    marginBottom: '0.4rem',
                  }}
                >
                  Space Name
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="space-name-input"
                    type="text"
                    className="veil-input"
                    placeholder="e.g. Main Space, Work, Personal"
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      backgroundColor: '#161d29',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '0.75rem 0.85rem 0.75rem 2.4rem',
                      color: '#f3f4f6',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--veil-text-secondary, #94a3b8)',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <LayersIcon size={16} />
                  </div>
                </div>
              </div>
            )}

            {/* Password Input with placeholder 'Enter Space Passphrase' */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="password-input"
                style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary, #94a3b8)',
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
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  color: '#f87171',
                  fontSize: '0.8rem',
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

            {/* Primary Action Button (Sign In / Unlock Space) */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading || !password.trim()}
              aria-label="Unlock Space"
              title="Unlock Space"
              style={{
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#14b8a6',
                fontWeight: 600,
                fontSize: '0.925rem',
                boxShadow: '0 4px 16px rgba(20, 184, 166, 0.28)',
              }}
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : mode === 'signin' ? (
                <>
                  <span>Sign In</span>
                  <span
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      padding: 0,
                      margin: -1,
                      overflow: 'hidden',
                      clip: 'rect(0, 0, 0, 0)',
                      whiteSpace: 'nowrap',
                      border: 0,
                    }}
                  >
                    Unlock Space
                  </span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </Button>

            {/* Switch Mode Pill (+ Create New Account) */}
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'create' : 'signin');
                  setError(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#14b8a6',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {mode === 'signin' ? '+ Create New Account' : 'Already have an account? Sign In'}
              </button>
            </div>

            {showCancel && onCancelPasswordFallback && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                fullWidth
                onClick={onCancelPasswordFallback}
                style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}
              >
                Back to PIN Lock
              </Button>
            )}
          </form>

          {/* Local Security Assurance */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--veil-text-secondary, #94a3b8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <LockIcon size={12} color="#14b8a6" />
              <span>Locally encrypted with Argon2id &amp; XChaCha20</span>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              Zero-knowledge multi-space architecture
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

