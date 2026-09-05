/**
 * VEIL "Protect VEIL" App Lock PIN Setup Modal.
 *
 * Guides user immediately following account authentication / creation:
 * - Allows choosing 4-digit or 6-digit PIN.
 * - Stage 1: Choose PIN.
 * - Stage 2: Confirm PIN.
 * - Real-time validation, PIN collision check, and secure wrapping via spacePinManager.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { spacePinManager } from '../../privacy/pinManager.ts';
import { LockIcon, ShieldIcon, AlertCircleIcon, DeleteIcon } from './icons/index.ts';
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

  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePin = step === 'create' ? firstPin : confirmPin;

  const handleDigit = (d: string) => {
    if (isSubmitting) return;
    setError(null);
    if (step === 'create') {
      if (firstPin.length < pinLength) {
        const next = firstPin + d;
        setFirstPin(next);
        if (next.length === pinLength) {
          // Check PIN availability before moving to confirm
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
          // Matching PIN: submit and save
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
        backdropFilter: 'blur(10px)',
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
          padding: '2.25rem 1.75rem',
          backgroundColor: 'var(--veil-bg-surface)',
          borderColor: 'var(--veil-border)',
          borderRadius: 'var(--veil-radius-xl)',
          textAlign: 'center',
          boxShadow: 'var(--veil-elevation-3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--veil-radius-lg)',
            backgroundColor: 'var(--veil-accent-primary-subtle)',
            border: '1px solid var(--veil-accent-primary-alpha)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--veil-accent-primary)',
            marginBottom: '1rem',
          }}
        >
          <ShieldIcon size={24} />
        </div>

        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            margin: '0 0 0.4rem 0',
            color: 'var(--veil-text-primary)',
          }}
        >
          Protect VEIL
        </h2>

        <p
          style={{
            fontSize: 'var(--veil-text-xs)',
            color: 'var(--veil-text-secondary)',
            margin: '0 0 1.5rem 0',
            lineHeight: 1.4,
          }}
        >
          {step === 'create'
            ? 'Create an app PIN to protect VEIL on this device.'
            : 'Confirm your app PIN to finish setup.'}
        </p>

        {/* PIN Length Switcher (only shown on create step) */}
        {step === 'create' && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              backgroundColor: 'var(--veil-bg-surface-elevated)',
              padding: '4px',
              borderRadius: 'var(--veil-radius-md)',
              marginBottom: '1.5rem',
              border: '1px solid var(--veil-border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPinLength(4);
                setFirstPin('');
                setError(null);
              }}
              style={{
                border: 'none',
                padding: '4px 14px',
                borderRadius: 'var(--veil-radius-sm)',
                fontSize: 'var(--veil-text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: pinLength === 4 ? 'var(--veil-accent-primary)' : 'transparent',
                color: pinLength === 4 ? '#ffffff' : 'var(--veil-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              4-digit PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setPinLength(6);
                setFirstPin('');
                setError(null);
              }}
              style={{
                border: 'none',
                padding: '4px 14px',
                borderRadius: 'var(--veil-radius-sm)',
                fontSize: 'var(--veil-text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: pinLength === 6 ? 'var(--veil-accent-primary)' : 'transparent',
                color: pinLength === 6 ? '#ffffff' : 'var(--veil-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              6-digit PIN
            </button>
          </div>
        )}

        {/* PIN Dot Indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '1.75rem',
          }}
        >
          {Array.from({ length: pinLength }).map((_, idx) => {
            const isFilled = idx < activePin.length;
            return (
              <div
                key={idx}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: isFilled ? 'var(--veil-accent-primary)' : 'transparent',
                  border: isFilled
                    ? '1px solid var(--veil-accent-primary)'
                    : '2px solid var(--veil-border-strong)',
                  transition: 'all 0.15s ease',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)',
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
              borderRadius: 'var(--veil-radius-md)',
              color: 'var(--veil-danger)',
              fontSize: 'var(--veil-text-xs)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              marginBottom: '1.25rem',
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
                      height: '54px',
                      borderRadius: 'var(--veil-radius-lg)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--veil-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: activePin.length > 0 ? 'pointer' : 'default',
                      opacity: activePin.length > 0 ? 1 : 0.4,
                    }}
                  >
                    <DeleteIcon size={20} />
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
                    height: '54px',
                    borderRadius: 'var(--veil-radius-lg)',
                    border: '1px solid var(--veil-border)',
                    backgroundColor: 'var(--veil-bg-surface-elevated)',
                    color: 'var(--veil-text-primary)',
                    fontSize: '1.3rem',
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
      </div>
    </div>
  );
};
