import React, { useState } from 'react';
import { spacePinManager } from '../../privacy/pinManager.ts';
import { themeManager, ACCENT_PALETTE, AccentColor } from '../utils/themeManager.ts';
import { ArrowLeftIcon, CheckIcon } from './icons/index.ts';

interface SecurityOptionsViewProps {
  onBack?: () => void;
}

export const SecurityOptionsView: React.FC<SecurityOptionsViewProps> = ({ onBack }) => {
  const [secOptions, setSecOptions] = useState(() => spacePinManager.getSecurityOptions());
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(() => spacePinManager.isBiometricsEnabled());
  const [activeAccent, setActiveAccent] = useState<AccentColor>(() => themeManager.getPreferences().accent);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleToggleSecOption = (key: 'hideContentInRecents' | 'screenCaptureProtection' | 'disableAppSwitcherPreview', val: boolean) => {
    spacePinManager.setSecurityOption(key, val);
    setSecOptions((prev) => ({ ...prev, [key]: val }));
    showNotice(`${key === 'hideContentInRecents' ? 'Hide in recents' : key === 'screenCaptureProtection' ? 'Screen capture protection' : 'App switcher preview'} updated`);
  };

  const handleToggleBiometrics = (val: boolean) => {
    spacePinManager.setBiometricsEnabled(val);
    setBiometricsEnabled(val);
    showNotice(val ? 'Biometric unlock enabled' : 'Biometric unlock disabled');
  };

  const handleSelectAccent = (colorId: AccentColor) => {
    themeManager.setAccent(colorId);
    setActiveAccent(colorId);
    showNotice(`Accent color updated to ${colorId}`);
  };

  return (
    <div className="veil-security-options-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
          Security Options
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
          Privacy is our priority
        </p>
      </div>

      {notice && (
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
          {notice}
        </div>
      )}

      {/* Toggles Card */}
      <div
        style={{
          backgroundColor: 'var(--veil-bg-surface)',
          border: '1px solid var(--veil-border)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Hide content in recents */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 500, color: 'var(--veil-text-primary)' }}>
            Hide content in recents
          </span>
          <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px' }}>
            <input
              type="checkbox"
              checked={secOptions.hideContentInRecents}
              onChange={(e) => handleToggleSecOption('hideContentInRecents', e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: secOptions.hideContentInRecents ? 'var(--veil-accent-primary)' : 'rgba(255, 255, 255, 0.15)',
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
                  left: secOptions.hideContentInRecents ? '23px' : '3px',
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

        {/* Screen capture protection */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 500, color: 'var(--veil-text-primary)' }}>
            Screen capture protection
          </span>
          <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px' }}>
            <input
              type="checkbox"
              checked={secOptions.screenCaptureProtection}
              onChange={(e) => handleToggleSecOption('screenCaptureProtection', e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: secOptions.screenCaptureProtection ? 'var(--veil-accent-primary)' : 'rgba(255, 255, 255, 0.15)',
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
                  left: secOptions.screenCaptureProtection ? '23px' : '3px',
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

        {/* Disable app switcher preview */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.1rem',
            borderBottom: '1px solid var(--veil-border-subtle)',
          }}
        >
          <span style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 500, color: 'var(--veil-text-primary)' }}>
            Disable app switcher preview
          </span>
          <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px' }}>
            <input
              type="checkbox"
              checked={secOptions.disableAppSwitcherPreview}
              onChange={(e) => handleToggleSecOption('disableAppSwitcherPreview', e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: secOptions.disableAppSwitcherPreview ? 'var(--veil-accent-primary)' : 'rgba(255, 255, 255, 0.15)',
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
                  left: secOptions.disableAppSwitcherPreview ? '23px' : '3px',
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

        {/* Biometric unlock */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.1rem',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 500, color: 'var(--veil-text-primary)' }}>
              Biometric unlock
            </div>
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginTop: '2px' }}>
              Use Face ID / Fingerprint
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px' }}>
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
                inset: 0,
                backgroundColor: biometricsEnabled ? 'var(--veil-accent-primary)' : 'rgba(255, 255, 255, 0.15)',
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
                  left: biometricsEnabled ? '23px' : '3px',
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
      </div>

      {/* Bottom Accent Color Swatch Banner */}
      <div
        style={{
          marginTop: '0.75rem',
          backgroundColor: 'var(--veil-bg-surface)',
          border: '1px solid var(--veil-border)',
          borderRadius: '16px',
          padding: '1.25rem 1rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--veil-text-secondary)', marginBottom: '0.9rem' }}>
          CHOOSE YOUR ACCENT. MAKE VEIL YOURS.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
          {ACCENT_PALETTE.map((pal) => (
            <button
              key={pal.id}
              type="button"
              onClick={() => handleSelectAccent(pal.id)}
              aria-label={`Select ${pal.label} accent`}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: pal.primary,
                border: activeAccent === pal.id ? '2px solid #ffffff' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: activeAccent === pal.id ? `0 0 10px ${pal.primary}` : 'none',
                transition: 'transform 0.15s ease',
              }}
            >
              {activeAccent === pal.id && <CheckIcon size={14} color="#ffffff" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
