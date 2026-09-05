import React, { useState } from 'react';
import { spacePinManager } from '../../privacy/pinManager.ts';
import { useApp } from '../app/AppState.tsx';
import { ArrowLeftIcon, ChevronRightIcon, LockIcon } from './icons/index.ts';

interface AppLockSettingsViewProps {
  onBack?: () => void;
  onOpenPinSetup?: () => void;
  onOpenAccountsAndSpaces?: () => void;
}

export const AppLockSettingsView: React.FC<AppLockSettingsViewProps> = ({
  onBack,
  onOpenPinSetup,
  onOpenAccountsAndSpaces,
}) => {
  const { lockSpace, setAppLocked, activeSession } = useApp();

  const [appLockEnabled, setAppLockEnabled] = useState<boolean>(() => spacePinManager.isAppLockEnabled());
  const [pinType, setPinType] = useState<'4-digit' | '6-digit'>(() => spacePinManager.getPinType(activeSession?.spaceId));
  const [afterExitingApp, setAfterExitingApp] = useState<string>(() => spacePinManager.getAfterExitingApp());
  const [afterBackground, setAfterBackground] = useState<string>(() => spacePinManager.getAfterBackground());
  const [afterScreenOff, setAfterScreenOff] = useState<string>(() => spacePinManager.getAfterScreenOff());
  const [afterInactivity, setAfterInactivity] = useState<string>(() => spacePinManager.getAfterInactivity());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const currentSpaceId = activeSession?.spaceId;
  const hasPinForCurrent = currentSpaceId ? spacePinManager.hasPinForSpace(currentSpaceId) : false;

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleToggleAppLock = (enabled: boolean) => {
    if (enabled && !hasPinForCurrent) {
      if (onOpenPinSetup) onOpenPinSetup();
      return;
    }
    spacePinManager.setAppLockEnabled(enabled);
    setAppLockEnabled(enabled);
    showNotice(enabled ? 'App Lock enabled' : 'App Lock disabled');
  };

  const cycleInterval = (
    current: string,
    options: string[],
    setter: (val: string) => void,
    persister: (val: string) => void,
    label: string
  ) => {
    const nextIdx = (options.indexOf(current) + 1) % options.length;
    const nextVal = options[nextIdx];
    setter(nextVal);
    persister(nextVal);
    showNotice(`${label} set to ${nextVal}`);
  };

  const handleLockNow = () => {
    if (setAppLocked) {
      setAppLocked(true);
    }
    lockSpace();
  };

  const formatIntervalLabel = (val: string) => {
    if (val === 'immediately') return 'Immediately';
    if (val === '30s') return '30 seconds';
    if (val === '1m') return '1 minute';
    if (val === '5m') return '5 minutes';
    if (val === '10m') return '10 minutes';
    if (val === '15m') return '15 minutes';
    if (val === 'never') return 'Never';
    return val;
  };

  return (
    <div className="veil-app-lock-settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--veil-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: 'var(--veil-text-sm)',
            padding: 0,
            width: 'fit-content',
          }}
        >
          <ArrowLeftIcon size={16} />
          <span>Back</span>
        </button>
      )}

      {/* Screen Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--veil-text-primary)' }}>
          App Lock Settings
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
          Control your security
        </p>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '0.6rem 0.85rem',
            borderRadius: '10px',
            backgroundColor: 'var(--veil-accent-primary-subtle)',
            border: '1px solid var(--veil-accent-primary-alpha)',
            color: 'var(--veil-accent-primary)',
            fontSize: 'var(--veil-text-xs)',
            fontWeight: 500,
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Card 1: Core Lock Controls */}
      <div
        style={{
          backgroundColor: 'var(--veil-bg-surface)',
          border: '1px solid var(--veil-border)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Row 1: Enable App Lock Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
            Enable App Lock
          </span>
          <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px' }}>
            <input
              type="checkbox"
              checked={appLockEnabled}
              onChange={(e) => handleToggleAppLock(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: appLockEnabled ? 'var(--veil-accent-primary)' : 'rgba(255, 255, 255, 0.15)',
                transition: '0.2s',
                borderRadius: '30px',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '20px',
                  width: '20px',
                  left: appLockEnabled ? '23px' : '3px',
                  bottom: '3px',
                  backgroundColor: '#ffffff',
                  transition: '0.2s',
                  borderRadius: '50%',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
            </span>
          </label>
        </div>

        {/* Row 2: Change PIN */}
        <div
          onClick={onOpenPinSetup}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenPinSetup?.();
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 500, color: 'var(--veil-text-primary)' }}>
            Change PIN
          </span>
          <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
        </div>

        {/* Row 3: PIN Type */}
        <div
          onClick={() => {
            const nextType = pinType === '6-digit' ? '4-digit' : '6-digit';
            setPinType(nextType);
            showNotice(`Default PIN format: ${nextType}`);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const nextType = pinType === '6-digit' ? '4-digit' : '6-digit';
              setPinType(nextType);
            }
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.1rem',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 500, color: 'var(--veil-text-primary)' }}>
            PIN Type
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)' }}>
            <span>{pinType}</span>
            <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
          </div>
        </div>
      </div>

      {/* Card 2: Auto Lock Settings */}
      <div
        style={{
          backgroundColor: 'var(--veil-bg-surface)',
          border: '1px solid var(--veil-border)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '0.9rem 1.1rem 0.5rem', fontSize: 'var(--veil-text-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--veil-text-muted)' }}>
          Auto Lock
        </div>

        {/* After exiting app */}
        <div
          onClick={() => cycleInterval(
            afterExitingApp,
            ['immediately', '1m', '5m', '10m', 'never'],
            setAfterExitingApp,
            (v) => spacePinManager.setAfterExitingApp(v),
            'After exiting app'
          )}
          role="button"
          tabIndex={0}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>After exiting app</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)' }}>
            <span>{formatIntervalLabel(afterExitingApp)}</span>
            <ChevronRightIcon size={16} color="var(--veil-text-muted)" />
          </div>
        </div>

        {/* After background */}
        <div
          onClick={() => cycleInterval(
            afterBackground,
            ['immediately', '30s', '1m', '5m', '10m', 'never'],
            setAfterBackground,
            (v) => {
              spacePinManager.setAfterBackground(v);
              spacePinManager.setLockOnBackgroundEnabled(v !== 'never');
            },
            'After background'
          )}
          role="button"
          tabIndex={0}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>After background</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)' }}>
            <span>{formatIntervalLabel(afterBackground)}</span>
            <ChevronRightIcon size={16} color="var(--veil-text-muted)" />
          </div>
        </div>

        {/* After screen off */}
        <div
          onClick={() => cycleInterval(
            afterScreenOff,
            ['immediately', '30s', '1m', '5m', 'never'],
            setAfterScreenOff,
            (v) => {
              spacePinManager.setAfterScreenOff(v);
              spacePinManager.setLockOnScreenOffEnabled(v !== 'never');
            },
            'After screen off'
          )}
          role="button"
          tabIndex={0}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>After screen off</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)' }}>
            <span>{formatIntervalLabel(afterScreenOff)}</span>
            <ChevronRightIcon size={16} color="var(--veil-text-muted)" />
          </div>
        </div>

        {/* After inactivity */}
        <div
          onClick={() => cycleInterval(
            afterInactivity,
            ['1m', '5m', '10m', '15m', 'never'],
            setAfterInactivity,
            (v) => spacePinManager.setAfterInactivity(v),
            'After inactivity'
          )}
          role="button"
          tabIndex={0}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.1rem',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>After inactivity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)' }}>
            <span>{formatIntervalLabel(afterInactivity)}</span>
            <ChevronRightIcon size={16} color="var(--veil-text-muted)" />
          </div>
        </div>
      </div>

      {/* Lock Now Button (Red pill button with lock icon) */}
      <div style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={handleLockNow}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.85rem 1rem',
            borderRadius: '14px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.28)',
            color: '#ef4444',
            fontSize: 'var(--veil-text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: '0.2s',
          }}
        >
          <LockIcon size={16} />
          <span>Lock Now</span>
        </button>
      </div>

      {onOpenAccountsAndSpaces && (
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={onOpenAccountsAndSpaces}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--veil-accent-primary)',
              fontSize: 'var(--veil-text-xs)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0.25rem',
            }}
          >
            Manage Accounts &amp; Spaces
          </button>
        </div>
      )}
    </div>
  );
};
