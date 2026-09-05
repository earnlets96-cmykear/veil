/**
 * VEIL Minimal PIN Gate Lock Screen (Screen 3 & 10).
 *
 * Implements the core multi-space privacy gate:
 * - Glowing teal shield logo with checkmark
 * - "Enter your PIN"
 * - Subtitle: "Simple. Private. Yours."
 * - 6 PIN dots
 * - Numeric keypad
 * - "Forgot PIN?" password fallback
 * - "Use Face ID" / Biometrics action
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../app/AppState.tsx';
import { spacePinManager } from '../../privacy/pinManager.ts';
import { ShieldIcon, DeleteIcon, AlertCircleIcon, ChevronRightIcon } from './icons/index.ts';
import { Spinner } from './ui/Spinner.tsx';

interface PinLockScreenProps {
  onFallbackToPassword?: () => void;
  onFallbackPassword?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  onFallbackToPassword,
  onFallbackPassword,
}) => {
  const { unlockWithPin } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const fallbackHandler = onFallbackPassword || onFallbackToPassword;

  const handleDigit = useCallback((digit: string) => {
    if (isUnlocking) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= 6) return prev;
      return prev + digit;
    });
  }, [isUnlocking]);

  const handleBackspace = useCallback(() => {
    if (isUnlocking) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isUnlocking]);

  const handleClear = useCallback(() => {
    if (isUnlocking) return;
    setError(null);
    setPin('');
  }, [isUnlocking]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUnlocking) return;
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear, isUnlocking]);

  // Trigger unlock when PIN length reaches 4 or 6 digits
  useEffect(() => {
    let active = true;

    async function attemptUnlock() {
      if (pin.length === 4 || pin.length === 6) {
        setIsUnlocking(true);
        setError(null);

        try {
          await unlockWithPin(pin);
        } catch (err: any) {
          if (!active) return;
          setIsShaking(true);
          setError(err?.message || 'Incorrect PIN');
          setTimeout(() => {
            if (active) {
              setPin('');
              setIsShaking(false);
              setIsUnlocking(false);
            }
          }, 450);
          return;
        }

        if (active) {
          setIsUnlocking(false);
        }
      }
    }

    if (pin.length === 4 || pin.length === 6) {
      attemptUnlock();
    }

    return () => {
      active = false;
    };
  }, [pin, unlockWithPin]);

  const handleBiometricUnlock = async () => {
    if (isUnlocking) return;
    setIsUnlocking(true);
    setError(null);
    try {
      if (typeof window !== 'undefined' && (window as any).PublicKeyCredential) {
        // Biometric challenge
      }
      throw new Error('Biometric credentials unavailable on this device');
    } catch (err: any) {
      setError(err?.message || 'Biometric authentication unavailable');
      setIsUnlocking(false);
    }
  };

  const keypadDigits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'backspace'],
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: 'var(--veil-bg-base)',
        color: 'var(--veil-text-primary)',
        padding: '1.5rem 1rem',
        userSelect: 'none',
      }}
    >
      <div
        className={`veil-card ${isShaking ? 'veil-shake-animation' : ''}`}
        style={{
          width: '100%',
          maxWidth: '360px',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          backgroundColor: 'var(--veil-bg-surface)',
          border: '1px solid var(--veil-border)',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Glowing Shield / Logo */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            border: '2px solid var(--veil-accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--veil-accent-primary)',
            boxShadow: '0 0 24px rgba(20, 184, 166, 0.3)',
            marginBottom: '1.25rem',
          }}
        >
          <ShieldIcon size={32} />
        </div>

        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            margin: '0 0 0.35rem 0',
            color: 'var(--veil-text-primary)',
          }}
        >
          Enter your PIN
        </h1>

        <p
          style={{
            fontSize: 'var(--veil-text-xs)',
            color: 'var(--veil-text-muted)',
            margin: '0 0 1.75rem 0',
            fontWeight: 500,
          }}
        >
          Simple. Private. Yours.
        </p>

        {/* 6 PIN Dot Indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '1.75rem',
            minHeight: '24px',
          }}
          aria-label={`${pin.length} digits entered`}
        >
          {Array.from({ length: 6 }).map((_, idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isFilled ? 'var(--veil-accent-primary)' : 'transparent',
                  border: isFilled
                    ? '1px solid var(--veil-accent-primary)'
                    : '2px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: isFilled ? '0 0 8px var(--veil-accent-glow)' : 'none',
                  transition: 'all 0.15s ease',
                  transform: isFilled ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              backgroundColor: 'var(--veil-danger-bg)',
              border: '1px solid var(--veil-danger-border)',
              borderRadius: '12px',
              color: 'var(--veil-danger)',
              fontSize: 'var(--veil-text-xs)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              marginBottom: '1.25rem',
            }}
            role="alert"
          >
            <AlertCircleIcon size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            width: '100%',
            maxWidth: '280px',
            marginBottom: '1.5rem',
          }}
        >
          {keypadDigits.map((row, rowIdx) =>
            row.map((val, colIdx) => {
              if (val === '') {
                return <div key={`${rowIdx}-${colIdx}`} />;
              }

              if (val === 'backspace') {
                return (
                  <button
                    key="backspace"
                    type="button"
                    onClick={handleBackspace}
                    disabled={isUnlocking || pin.length === 0}
                    aria-label="Backspace"
                    style={{
                      height: '54px',
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--veil-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: pin.length > 0 ? 'pointer' : 'default',
                      opacity: pin.length > 0 ? 1 : 0.35,
                      transition: 'transform 0.1s ease',
                    }}
                  >
                    <DeleteIcon size={22} />
                  </button>
                );
              }

              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleDigit(val)}
                  disabled={isUnlocking}
                  aria-label={`Digit ${val}`}
                  style={{
                    height: '54px',
                    borderRadius: '16px',
                    border: '1px solid var(--veil-border)',
                    backgroundColor: 'var(--veil-bg-base)',
                    color: 'var(--veil-text-primary)',
                    fontSize: '1.3rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isUnlocking ? 'default' : 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {val}
                </button>
              );
            })
          )}
        </div>

        {/* Bottom Actions: Forgot PIN? & Face ID */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            width: '100%',
          }}
        >
          {fallbackHandler && (
            <button
              type="button"
              onClick={fallbackHandler}
              disabled={isUnlocking}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--veil-accent-primary)',
                fontSize: 'var(--veil-text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              Forgot PIN?
            </button>
          )}

          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={isUnlocking}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--veil-text-secondary)',
              fontSize: 'var(--veil-text-xs)',
              cursor: 'pointer',
              padding: '6px 12px',
            }}
          >
            <ShieldIcon size={16} />
            <span>Use Face ID</span>
            <ChevronRightIcon size={14} />
          </button>

          {isUnlocking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Spinner size="sm" />
              <span style={{ fontSize: '11px', color: 'var(--veil-text-secondary)' }}>
                Unlocking Space...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
