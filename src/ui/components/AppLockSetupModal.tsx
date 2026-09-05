/**
 * VEIL "Set App Lock" PIN Setup Modal (Screen 2).
 *
 * Implements real App Lock onboarding & PIN configuration:
 * - Glowing circular lock badge in teal
 * - 4 or 6 digit PIN option with toggle button
 * - Stage 1: Choose PIN
 * - Stage 2: Confirm PIN
 * - Real collision prevention and persistent onboarding completion
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { spacePinManager } from '../../privacy/pinManager.ts';
import { LockIcon, ShieldIcon, AlertCircleIcon, DeleteIcon, ArrowLeftIcon } from './icons/index.ts';

interface AppLockSetupModalProps {
  onComplete?: () => void;
  spaceId?: string;
  username?: string;
  spaceName?: string;
  password?: string;
  accountId?: string;
}

export const AppLockSetupModal: React.FC<AppLockSetupModalProps> = ({
  onComplete,
  spaceId,
  username,
  spaceName,
  password,
  accountId,
}) => {
  const { setupSpacePin, closeModal, activeSession, myProfile } = useApp();
  const targetSpaceId = spaceId || activeSession?.spaceId || '';
  const targetUsername = username || myProfile?.username || '';
  const targetSpaceName = spaceName || activeSession?.name || targetUsername || 'Primary Space';

  const [pinLength, setPinLength] = useState<4 | 6>(6);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePin = step === 'create' ? firstPin : confirmPin;

  const handleDismiss = () => {
    if (targetSpaceId) {
      spacePinManager.setOnboardingCompleted(targetSpaceId, true);
    }
    if (onComplete) {
      onComplete();
    } else {
      closeModal();
    }
  };

  const handleDigit = (d: string) => {
    if (isSubmitting) return;
    setError(null);
    if (step === 'create') {
      if (firstPin.length < pinLength) {
        const next = firstPin + d;
        setFirstPin(next);
        if (next.length === pinLength) {
          const avail = spacePinManager.isPinAvailableSync(next, targetSpaceId);
          if (!avail) {
            setError('This PIN is unavailable. Please choose a different PIN.');
            setFirstPin('');
            return;
          }
          setTimeout(() => setStep('confirm'), 200);
        }
      }
    } else {
      if (confirmPin.length < pinLength) {
        const next = confirmPin + d;
        setConfirmPin(next);
        if (next.length === pinLength) {
          if (next !== firstPin) {
            setError('PINs do not match. Please try again.');
            setConfirmPin('');
            setStep('create');
            setFirstPin('');
            return;
          }
          submitPin(next);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    setError(null);
    if (step === 'create') {
      setFirstPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const submitPin = async (finalPin: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await setupSpacePin({
        spaceId: targetSpaceId,
        username: targetUsername,
        spaceName: targetSpaceName,
        password: password || '',
        pin: finalPin,
        accountId,
      });
      spacePinManager.setOnboardingCompleted(targetSpaceId, true);
      spacePinManager.setAppLockEnabled(true);
      if (onComplete) {
        onComplete();
      } else {
        closeModal();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to setup App PIN');
      setStep('create');
      setFirstPin('');
      setConfirmPin('');
      setIsSubmitting(false);
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
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="veil-card"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '1.75rem 1.5rem',
          backgroundColor: 'var(--veil-bg-base)',
          border: '1px solid var(--veil-border)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Top Header Row with Back Button */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--veil-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            <ArrowLeftIcon size={18} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--veil-text-primary)' }}>
              Set App Lock
            </div>
            <div style={{ fontSize: '11px', color: 'var(--veil-text-muted)' }}>
              Secure your VEIL
            </div>
          </div>
          <div style={{ width: '24px' }} />
        </div>

        {/* Glowing Lock Badge */}
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
            boxShadow: '0 0 20px rgba(20, 184, 166, 0.25)',
            marginBottom: '1rem',
          }}
        >
          <LockIcon size={28} />
        </div>

        {/* Title & Subtitle */}
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            margin: '0 0 0.4rem 0',
            color: 'var(--veil-text-primary)',
          }}
        >
          {step === 'create' ? 'Set App Lock' : 'Confirm your PIN'}
        </h2>

        <p
          style={{
            fontSize: 'var(--veil-text-xs)',
            color: 'var(--veil-text-secondary)',
            margin: '0 0 1.5rem 0',
            lineHeight: 1.4,
            textAlign: 'center',
            whiteSpace: 'pre-line',
          }}
        >
          {step === 'create'
            ? 'Choose a 4 or 6 digit PIN\nYou\'ll use this to unlock VEIL'
            : 'Re-enter your PIN to verify and complete setup.'}
        </p>

        {/* PIN Dot Indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '1.5rem',
          }}
        >
          {Array.from({ length: pinLength }).map((_, idx) => {
            const isFilled = idx < activePin.length;
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

        {/* Error Notification */}
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
              marginBottom: '1rem',
            }}
          >
            <AlertCircleIcon size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            width: '100%',
            maxWidth: '280px',
            marginBottom: '1rem',
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
                    disabled={isSubmitting || activePin.length === 0}
                    style={{
                      height: '52px',
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--veil-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: activePin.length > 0 ? 'pointer' : 'default',
                      opacity: activePin.length > 0 ? 1 : 0.35,
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
                  disabled={isSubmitting}
                  style={{
                    height: '52px',
                    borderRadius: '16px',
                    border: '1px solid var(--veil-border)',
                    backgroundColor: 'var(--veil-bg-surface)',
                    color: 'var(--veil-text-primary)',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {val}
                </button>
              );
            })
          )}
        </div>

        {/* 4 or 6-digit PIN Toggle Button */}
        {step === 'create' && (
          <button
            type="button"
            onClick={() => {
              const nextLen = pinLength === 6 ? 4 : 6;
              setPinLength(nextLen);
              setFirstPin('');
              setError(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--veil-accent-primary)',
              fontSize: 'var(--veil-text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '1.25rem',
              padding: '6px 12px',
            }}
          >
            {pinLength === 6 ? 'Use 4-digit PIN' : 'Use 6-digit PIN'}
          </button>
        )}

        {/* Footer Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--veil-border-subtle)',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <ShieldIcon size={16} color="var(--veil-text-muted)" />
          <span style={{ fontSize: '11px', color: 'var(--veil-text-muted)' }}>
            This PIN locks and unlocks all your spaces on this device.
          </span>
        </div>
      </div>
    </div>
  );
};
