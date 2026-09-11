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

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../app/AppState.tsx';
import { spacePinManager } from '../../privacy/pinManager.ts';
import { LockIcon, ShieldIcon, AlertCircleIcon, DeleteIcon, ArrowLeftIcon, CheckIcon, ChevronRightIcon } from './icons/index.ts';
import { Button } from './ui/Button.tsx';

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

  const handleDigit = useCallback((d: string) => {
    if (isSubmitting) return;
    setError(null);
    if (step === 'create') {
      setFirstPin((prev) => {
        if (prev.length >= pinLength) return prev;
        return prev + d;
      });
    } else {
      setConfirmPin((prev) => {
        if (prev.length >= pinLength) return prev;
        return prev + d;
      });
    }
  }, [isSubmitting, pinLength, step]);

  const handleBackspace = useCallback(() => {
    if (isSubmitting) return;
    setError(null);
    if (step === 'create') {
      setFirstPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  }, [isSubmitting, step]);

  const handleContinueCreate = useCallback(() => {
    if (firstPin.length !== pinLength) {
      setError(`Please enter a full ${pinLength}-digit PIN.`);
      return;
    }
    const avail = spacePinManager.isPinAvailableSync(firstPin, targetSpaceId);
    if (!avail) {
      setError('This PIN is unavailable. Please choose a different PIN.');
      setFirstPin('');
      return;
    }
    setError(null);
    setStep('confirm');
  }, [firstPin, pinLength, targetSpaceId]);

  const submitPin = useCallback(async (finalPin: string) => {
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
  }, [accountId, closeModal, onComplete, password, setupSpacePin, targetSpaceId, targetSpaceName, targetUsername]);

  const handleConfirmSubmit = useCallback(() => {
    if (confirmPin.length !== pinLength) {
      setError(`Please enter all ${pinLength} digits to confirm.`);
      return;
    }
    if (confirmPin !== firstPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      setStep('create');
      setFirstPin('');
      return;
    }
    submitPin(confirmPin);
  }, [confirmPin, firstPin, pinLength, submitPin]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return;
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (step === 'create') {
          if (firstPin.length === pinLength) handleContinueCreate();
        } else {
          if (confirmPin.length === pinLength) handleConfirmSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmPin.length, firstPin.length, handleBackspace, handleConfirmSubmit, handleContinueCreate, handleDigit, isSubmitting, pinLength, step]);

  const keypadDigits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['backspace', '0', 'enter'],
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
          role="group"
          aria-label="PIN setup indicator"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '1.5rem',
            minHeight: '24px',
          }}
        >
          {activePin.length === 0 ? (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--veil-text-muted)',
                letterSpacing: '0.04em',
                fontWeight: 500,
                height: '24px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Enter {pinLength}-digit PIN
            </div>
          ) : (
            Array.from({ length: activePin.length }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--veil-accent-primary)',
                  boxShadow: '0 0 10px var(--veil-accent-glow)',
                  animation: 'veil-pin-dot-pop 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              />
            ))
          )}
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

              if (val === 'enter') {
                const isReady = step === 'create' ? firstPin.length === pinLength : confirmPin.length === pinLength;
                const onAction = step === 'create' ? handleContinueCreate : handleConfirmSubmit;
                return (
                  <button
                    key="enter"
                    type="button"
                    onClick={onAction}
                    disabled={isSubmitting || !isReady}
                    aria-label={step === 'create' ? 'Continue' : 'Confirm PIN'}
                    title={step === 'create' ? 'Continue' : 'Confirm PIN'}
                    style={{
                      height: '52px',
                      borderRadius: '16px',
                      border: isReady
                        ? '1px solid var(--veil-accent-primary)'
                        : '1px solid var(--veil-border-subtle, rgba(255, 255, 255, 0.08))',
                      backgroundColor: isReady ? 'var(--veil-accent-primary)' : 'transparent',
                      color: isReady ? '#ffffff' : 'var(--veil-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: isReady && !isSubmitting ? 'pointer' : 'default',
                      opacity: isReady ? 1 : 0.35,
                      boxShadow: isReady ? '0 0 14px var(--veil-accent-glow)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <CheckIcon size={18} strokeWidth={2.5} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>OK</span>
                  </button>
                );
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

        {/* Explicit Continue / Confirm Button */}
        <div style={{ width: '100%', maxWidth: '280px', marginBottom: '0.85rem' }}>
          {step === 'create' ? (
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={handleContinueCreate}
              disabled={firstPin.length !== pinLength}
              aria-label="Continue"
              style={{
                height: '46px',
                borderRadius: '14px',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              <span>Continue</span>
              <ChevronRightIcon size={16} />
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('create');
                  setConfirmPin('');
                  setError(null);
                }}
                disabled={isSubmitting}
                style={{ height: '46px', borderRadius: '14px', flex: '0 0 auto' }}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={handleConfirmSubmit}
                disabled={confirmPin.length !== pinLength || isSubmitting}
                loading={isSubmitting}
                aria-label="Confirm PIN"
                style={{
                  height: '46px',
                  borderRadius: '14px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                <CheckIcon size={16} />
                <span>Confirm PIN</span>
              </Button>
            </div>
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
