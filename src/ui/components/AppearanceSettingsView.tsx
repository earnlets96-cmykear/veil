import React, { useState, useEffect } from 'react';
import {
  themeManager,
  ACCENT_PALETTE,
  THEME_OPTIONS,
  AccentColor,
  ThemeMode,
} from '../utils/themeManager.ts';
import {
  ArrowLeftIcon,
  CheckIcon,
  MoonIcon,
  DropletIcon,
  FlameIcon,
  HeartIcon,
  ShieldIcon,
  LayersIcon,
  ClockIcon,
  PhoneIcon,
  CodeIcon,
  DatabaseSlashIcon,
} from './icons/index.ts';

interface AppearanceSettingsViewProps {
  onBack?: () => void;
}

export const AppearanceSettingsView: React.FC<AppearanceSettingsViewProps> = ({ onBack }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => themeManager.getTheme());
  const [currentAccent, setCurrentAccent] = useState<AccentColor>(() => themeManager.getAccent());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = themeManager.subscribe((settings) => {
      setCurrentTheme(settings.theme);
      setCurrentAccent(settings.accent);
    });
    return unsub;
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const handleSelectTheme = (theme: ThemeMode) => {
    themeManager.setTheme(theme);
    setCurrentTheme(theme);
    showNotice(`Theme updated to ${theme}`);
  };

  const handleSelectAccent = (accent: AccentColor) => {
    themeManager.setAccent(accent);
    setCurrentAccent(accent);
    showNotice(`Accent color updated to ${accent}`);
  };

  const renderThemeIcon = (id: ThemeMode) => {
    switch (id) {
      case 'midnight':
      case 'dark':
      case 'amoled':
        return <MoonIcon size={20} color="var(--veil-accent-primary)" />;
      case 'ocean':
        return <DropletIcon size={20} color="#3b82f6" />;
      case 'forest':
        return <FlameIcon size={20} color="#22c55e" />;
      case 'amber':
        return <FlameIcon size={20} color="#f59e0b" />;
      case 'rose':
        return <HeartIcon size={20} color="#f43f5e" />;
      case 'slate':
      case 'light':
      default:
        return <CheckIcon size={20} color="#94a3b8" />;
    }
  };

  const showcaseThemes = THEME_OPTIONS.filter((t) =>
    ['midnight', 'ocean', 'forest', 'amber', 'rose', 'slate'].includes(t.id)
  );

  return (
    <div className="veil-customize-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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

      {/* Title */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--veil-text-primary)' }}>
          Customize Your VEIL
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
          Make it yours.
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

      {/* Section 1: Themes */}
      <div>
        <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--veil-text-muted)', marginBottom: '0.65rem' }}>
          Themes
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.65rem',
          }}
        >
          {showcaseThemes.map((opt) => {
            const isSelected = currentTheme === opt.id || (currentTheme === 'dark' && opt.id === 'midnight');
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectTheme(opt.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem 0.65rem',
                  borderRadius: '16px',
                  backgroundColor: opt.bgHex,
                  border: isSelected ? '2px solid var(--veil-accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 14px var(--veil-accent-glow)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderThemeIcon(opt.id)}
                </div>
                <span
                  style={{
                    fontSize: 'var(--veil-text-xs)',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? 'var(--veil-accent-primary)' : 'var(--veil-text-primary)',
                  }}
                >
                  {opt.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Accent Color */}
      <div>
        <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--veil-text-muted)', marginBottom: '0.65rem' }}>
          Accent Color
        </div>
        <div
          style={{
            backgroundColor: 'var(--veil-bg-surface)',
            border: '1px solid var(--veil-border)',
            borderRadius: '16px',
            padding: '1rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.65rem',
            justifyContent: 'center',
          }}
        >
          {ACCENT_PALETTE.map((pal) => (
            <button
              key={pal.id}
              type="button"
              onClick={() => handleSelectAccent(pal.id)}
              aria-label={`Select ${pal.label} accent`}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: pal.primary,
                border: currentAccent === pal.id ? '2px solid #ffffff' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: currentAccent === pal.id ? `0 0 10px ${pal.primary}` : 'none',
                transition: 'transform 0.15s ease',
              }}
            >
              {currentAccent === pal.id && <CheckIcon size={16} color="#ffffff" />}
            </button>
          ))}
        </div>
      </div>

      {/* Section 3: Feature Callout Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.65rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--veil-bg-surface)',
            border: '1px solid var(--veil-border)',
            borderRadius: '14px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <ShieldIcon size={20} color="var(--veil-accent-primary)" />
          <div>
            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
              End-to-End Encrypted
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--veil-bg-surface)',
            border: '1px solid var(--veil-border)',
            borderRadius: '14px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <LayersIcon size={20} color="var(--veil-accent-primary)" />
          <div>
            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
              Multi-Space Isolation
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--veil-bg-surface)',
            border: '1px solid var(--veil-border)',
            borderRadius: '14px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <DatabaseSlashIcon size={20} color="var(--veil-accent-primary)" />
          <div>
            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
              No Cloud Backup
            </div>
            <div style={{ fontSize: '10px', color: 'var(--veil-text-muted)' }}>
              Your data, yours only
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--veil-bg-surface)',
            border: '1px solid var(--veil-border)',
            borderRadius: '14px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <ClockIcon size={20} color="var(--veil-accent-primary)" />
          <div>
            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
              Ephemeral by Choice
            </div>
            <div style={{ fontSize: '10px', color: 'var(--veil-text-muted)' }}>
              Set timers per chat
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--veil-bg-surface)',
            border: '1px solid var(--veil-border)',
            borderRadius: '14px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <PhoneIcon size={20} color="var(--veil-accent-primary)" />
          <div>
            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
              Secure Calls
            </div>
            <div style={{ fontSize: '10px', color: 'var(--veil-text-muted)' }}>
              Coming Soon
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--veil-bg-surface)',
            border: '1px solid var(--veil-border)',
            borderRadius: '14px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <CodeIcon size={20} color="var(--veil-accent-primary)" />
          <div>
            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
              Open Source Friendly
            </div>
            <div style={{ fontSize: '10px', color: 'var(--veil-text-muted)' }}>
              Transparency always
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
