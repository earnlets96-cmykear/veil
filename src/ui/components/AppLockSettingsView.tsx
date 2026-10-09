import React, { useState } from 'react';
import { spacePinManager } from '../../privacy/pinManager.ts';
import type { AppLockDelay } from '../../privacy/appLockPolicy.ts';
import { isAppLockScreenOffSupported } from '../../privacy/nativeAppLockBridge.ts';
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
  const [leaveAppDelay, setLeaveAppDelay] = useState<AppLockDelay>(() => spacePinManager.getLeaveAppLockDelay());
  const [screenOffDelay, setScreenOffDelay] = useState<AppLockDelay>(() => spacePinManager.getScreenOffLockDelay());
  const [inactivityDelay, setInactivityDelay] = useState<AppLockDelay>(() => spacePinManager.getInactivityLockDelay());
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
    if (!spacePinManager.setAppLockEnabled(enabled)) {
      showNotice('Could not save App Lock. Your previous setting is still active.');
      return;
    }
    setAppLockEnabled(enabled);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('veil:app-lock-settings-changed'));
    showNotice(enabled ? 'App Lock enabled' : 'App Lock disabled');
  };

  const saveDelay = (
    value: AppLockDelay,
    setter: (delay: AppLockDelay) => void,
    persist: (delay: AppLockDelay) => boolean,
    label: string,
  ) => {
    if (!persist(value)) {
      showNotice(`Could not save ${label}. Your previous setting is still active.`);
      return;
    }
    setter(value);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('veil:app-lock-settings-changed'));
    showNotice(`${label} saved: ${formatIntervalLabel(value)}`);
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
          role="status"
          aria-live="polite"
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
            spacePinManager.setPinType(nextType, currentSpaceId);
            showNotice(`Default PIN format: ${nextType}`);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const nextType = pinType === '6-digit' ? '4-digit' : '6-digit';
              setPinType(nextType);
              spacePinManager.setPinType(nextType, currentSpaceId);
              showNotice(`Default PIN format: ${nextType}`);
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

      {/* App Lock timing controls */}
      <div
        style={{
          backgroundColor: 'var(--veil-bg-surface)',
          border: '1px solid var(--veil-border)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.1rem', display: 'grid', gap: '0.45rem' }}>
          <label htmlFor="veil-leave-app-delay" style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
            When you leave VEIL
          </label>
          <select
            id="veil-leave-app-delay"
            className="veil-select"
            value={leaveAppDelay}
            onChange={(event) => saveDelay(event.target.value as AppLockDelay, setLeaveAppDelay, (delay) => spacePinManager.setLeaveAppLockDelay(delay), 'Leave VEIL delay')}
            style={{ minHeight: 44 }}
          >
            {(['immediately', '30s', '1m', '5m', '10m', '15m', 'never'] as AppLockDelay[]).map((delay) => <option key={delay} value={delay}>{formatIntervalLabel(delay)}</option>)}
          </select>
          <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>Lock when this delay has elapsed after VEIL goes to the background.</span>
        </div>

        <div style={{ padding: '1rem 1.1rem', display: 'grid', gap: '0.45rem', borderTop: '1px solid var(--veil-border-subtle)' }}>
          <label htmlFor="veil-inactivity-delay" style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
            While using VEIL
          </label>
          <select
            id="veil-inactivity-delay"
            className="veil-select"
            value={inactivityDelay}
            onChange={(event) => saveDelay(event.target.value as AppLockDelay, setInactivityDelay, (delay) => spacePinManager.setInactivityLockDelay(delay), 'Inactivity delay')}
            style={{ minHeight: 44 }}
          >
            {(['1m', '5m', '10m', '15m', 'never'] as AppLockDelay[]).map((delay) => <option key={delay} value={delay}>{formatIntervalLabel(delay)}</option>)}
          </select>
          <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>Lock after no pointer, keyboard, or touch activity.</span>
        </div>

        {isAppLockScreenOffSupported() && (
          <div style={{ padding: '1rem 1.1rem', display: 'grid', gap: '0.45rem', borderTop: '1px solid var(--veil-border-subtle)' }}>
            <label htmlFor="veil-screen-off-delay" style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
              When screen turns off
            </label>
            <select
              id="veil-screen-off-delay"
              className="veil-select"
              value={screenOffDelay}
              onChange={(event) => saveDelay(event.target.value as AppLockDelay, setScreenOffDelay, (delay) => spacePinManager.setScreenOffLockDelay(delay), 'Screen-off delay')}
              style={{ minHeight: 44 }}
            >
              {(['immediately', '30s', '1m', '5m', '10m', '15m', 'never'] as AppLockDelay[]).map((delay) => <option key={delay} value={delay}>{formatIntervalLabel(delay)}</option>)}
            </select>
            <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>Android checks this setting when VEIL resumes after the screen turns off.</span>
          </div>
        )}
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
