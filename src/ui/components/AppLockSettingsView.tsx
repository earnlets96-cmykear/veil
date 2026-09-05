import React, { useState } from 'react';
import { spacePinManager, AutoLockInterval } from '../../privacy/pinManager.ts';
import { useApp } from '../app/AppState.tsx';
import { ArrowLeftIcon } from './icons/index.ts';

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
  const { lockSpace, activeSession, myProfile } = useApp();

  const [appLockEnabled, setAppLockEnabled] = useState<boolean>(() => spacePinManager.isAppLockEnabled());
  const [autoLockInterval, setAutoLockInterval] = useState<AutoLockInterval>(() => spacePinManager.getAutoLockInterval());
  const [lockOnBackground, setLockOnBackground] = useState<boolean>(() => spacePinManager.isLockOnBackgroundEnabled());
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(() => spacePinManager.isBiometricsEnabled());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const currentSpaceId = activeSession?.spaceId;
  const hasPinForCurrent = currentSpaceId ? spacePinManager.hasPinForSpace(currentSpaceId) : false;
  const registeredSpaces = spacePinManager.getRegisteredSpacesMetadata();

  const handleToggleAppLock = (enabled: boolean) => {
    if (enabled && !hasPinForCurrent) {
      // Need to set up PIN first
      if (onOpenPinSetup) {
        onOpenPinSetup();
      }
      return;
    }
    spacePinManager.setAppLockEnabled(enabled);
    setAppLockEnabled(enabled);
    showNotice(enabled ? 'App lock enabled' : 'App lock disabled');
  };

  const handleIntervalChange = (val: AutoLockInterval) => {
    spacePinManager.setAutoLockInterval(val);
    setAutoLockInterval(val);
    showNotice(`Auto-lock set to ${val}`);
  };

  const handleToggleBackground = (enabled: boolean) => {
    spacePinManager.setLockOnBackgroundEnabled(enabled);
    setLockOnBackground(enabled);
    showNotice(enabled ? 'Lock on background enabled' : 'Lock on background disabled');
  };

  const handleToggleBiometrics = (enabled: boolean) => {
    spacePinManager.setBiometricsEnabled(enabled);
    setBiometricsEnabled(enabled);
    showNotice(enabled ? 'Biometric unlock enabled' : 'Biometric unlock disabled');
  };

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {onBack && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: 0,
            }}
          >
            <ArrowLeftIcon size={14} />
            <span>Back to Settings</span>
          </button>
        </div>
      )}

      <div>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
          App Lock & Multi-Space Access
        </h2>
        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #94a3b8)' }}>
          Protect your active space with a PIN. In VEIL, each PIN silently gates a distinct space without revealing space existence on the lock screen.
        </p>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            border: '1px solid rgba(20, 184, 166, 0.25)',
            color: 'var(--accent-color, #14b8a6)',
            fontSize: '13px',
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Main Lock Toggle */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary, #15171c)',
          border: '1px solid var(--border-color, #272a34)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Require PIN to Unlock
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
            {hasPinForCurrent ? 'PIN configured for current space' : 'No PIN configured for current space'}
          </div>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
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
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: appLockEnabled ? 'var(--accent-color, #14b8a6)' : '#334155',
              transition: '0.2s',
              borderRadius: '24px',
            }}
          >
            <span
              style={{
                position: 'absolute',
                content: '""',
                height: '18px',
                width: '18px',
                left: appLockEnabled ? '23px' : '3px',
                bottom: '3px',
                backgroundColor: '#ffffff',
                transition: '0.2s',
                borderRadius: '50%',
              }}
            />
          </span>
        </label>
      </div>

      {/* PIN Configuration for Current Space */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary, #15171c)',
          border: '1px solid var(--border-color, #272a34)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Space Access PIN
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
            {hasPinForCurrent
              ? 'Change the 4 or 6-digit access PIN for this space'
              : 'Set up a PIN to directly access this space'}
          </div>
        </div>
        <button
          onClick={onOpenPinSetup}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-tertiary, #1f222a)',
            border: '1px solid var(--border-color, #272a34)',
            color: 'var(--text-primary, #f8fafc)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {hasPinForCurrent ? 'Change PIN' : 'Set Up PIN'}
        </button>
      </div>

      {/* Auto-Lock Settings */}
      {appLockEnabled && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary, #15171c)',
            border: '1px solid var(--border-color, #272a34)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Auto-Lock Interval
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {(['immediately', '30s', '1m', '5m', '10m', 'never'] as AutoLockInterval[]).map((interval) => (
              <button
                key={interval}
                onClick={() => handleIntervalChange(interval)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${autoLockInterval === interval ? 'var(--accent-color, #14b8a6)' : 'var(--border-color, #272a34)'}`,
                  backgroundColor: autoLockInterval === interval ? 'rgba(20, 184, 166, 0.12)' : 'var(--bg-tertiary, #1f222a)',
                  color: autoLockInterval === interval ? 'var(--accent-color, #14b8a6)' : 'var(--text-secondary, #94a3b8)',
                  fontSize: '12px',
                  fontWeight: autoLockInterval === interval ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {interval === 'immediately' ? 'Immediate' : interval}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-color, #272a34)',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary, #f8fafc)' }}>Lock on App Background</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                Lock session as soon as app is minimized
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
              <input
                type="checkbox"
                checked={lockOnBackground}
                onChange={(e) => handleToggleBackground(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: lockOnBackground ? 'var(--accent-color, #14b8a6)' : '#334155',
                  transition: '0.2s',
                  borderRadius: '22px',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '16px',
                    width: '16px',
                    left: lockOnBackground ? '21px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#ffffff',
                    transition: '0.2s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-color, #272a34)',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary, #f8fafc)' }}>Biometric Unlock</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                Fingerprint / Face ID for fast return to current space
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
              <input
                type="checkbox"
                checked={biometricsEnabled}
                onChange={(e) => handleToggleBiometrics(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: biometricsEnabled ? 'var(--accent-color, #14b8a6)' : '#334155',
                  transition: '0.2s',
                  borderRadius: '22px',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '16px',
                    width: '16px',
                    left: biometricsEnabled ? '21px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#ffffff',
                    transition: '0.2s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Multi-Space Management Link */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary, #15171c)',
          border: '1px solid var(--border-color, #272a34)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Registered Spaces on This Device
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
            {registeredSpaces.length} {registeredSpaces.length === 1 ? 'space has' : 'spaces have'} PIN access configured
          </div>
        </div>
        {onOpenAccountsAndSpaces && (
          <button
            onClick={onOpenAccountsAndSpaces}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-tertiary, #1f222a)',
              border: '1px solid var(--border-color, #272a34)',
              color: 'var(--accent-color, #14b8a6)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Manage Spaces
          </button>
        )}
      </div>

      {/* Immediate Lock Action */}
      <div style={{ paddingTop: '8px' }}>
        <button
          onClick={lockSpace}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          Lock App Now
        </button>
      </div>
    </div>
  );
};
