import React, { useEffect, useState } from 'react';
import {
  ACCENT_PALETTE,
  BUBBLE_STYLES,
  FONT_SIZES,
  THEME_OPTIONS,
  WALLPAPERS,
  themeManager,
  type AppearancePreferences,
  type BubbleStyle,
  type FontSizeSetting,
} from '../utils/themeManager.ts';
import { ArrowLeftIcon, CheckIcon } from './icons/index.ts';

interface AppearanceSettingsViewProps {
  onBack?: () => void;
}

const THEME_COLLECTIONS = ['Minimal', 'Nature', 'Expressive'] as const;

export const AppearanceSettingsView: React.FC<AppearanceSettingsViewProps> = ({ onBack }) => {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => themeManager.getPreferences());
  const [notice, setNotice] = useState('');
  const selectedTheme = preferences.theme === 'dark'
    ? 'midnight'
    : preferences.theme === 'dim'
      ? 'slate'
      : preferences.theme;

  useEffect(() => themeManager.subscribe(setPreferences), []);

  const handleReset = () => {
    themeManager.resetToDefaults();
    setNotice('Default appearance restored.');
  };

  return (
    <div className="veil-appearance-studio">
      {onBack && (
        <button className="veil-appearance-back" type="button" onClick={onBack}>
          <ArrowLeftIcon size={16} />
          <span>Back to settings</span>
        </button>
      )}

      <header className="veil-appearance-heading">
        <div>
          <h2>Make VEIL yours</h2>
          <p>Choose a palette, set the mood, and tune your chats.</p>
        </div>
        <button className="veil-appearance-reset" type="button" onClick={handleReset}>
          Reset
        </button>
      </header>
      {notice && <p className="veil-appearance-notice" role="status">{notice}</p>}

      <section className="veil-appearance-preview-wrap" aria-labelledby="appearance-preview-title">
        <div className="veil-appearance-section-heading">
          <div>
            <h3 id="appearance-preview-title">Live preview</h3>
            <p>Updates as you customize</p>
          </div>
          <span className="veil-appearance-preview-label">YOUR CHAT</span>
        </div>
        <div
          className={`veil-appearance-preview veil-wallpaper-pattern--${preferences.wallpaper}`}
          data-wallpaper={preferences.wallpaper}
          data-bubble-style={preferences.bubbleStyle}
        >
          <div className="veil-appearance-preview-topline">
            <span className="veil-appearance-preview-avatar" aria-hidden="true">M</span>
            <div><strong>Morgan</strong><span>Personal space</span></div>
            <span className="veil-appearance-preview-lock">Encrypted</span>
          </div>
          <div className="veil-appearance-preview-messages">
            <div className="veil-bubble veil-bubble-incoming">Hey, found a quiet place for coffee.</div>
            <div className="veil-bubble veil-bubble-outgoing">That sounds perfect. See you there.</div>
          </div>
          <div className="veil-appearance-preview-composer"><span>Message</span><span>Send</span></div>
        </div>
      </section>

      <section className="veil-appearance-section" aria-labelledby="appearance-themes-title">
        <div className="veil-appearance-section-heading">
          <div>
            <h3 id="appearance-themes-title">Theme collections</h3>
            <p>Curated palettes for every kind of mood</p>
          </div>
          <span className="veil-appearance-current" aria-live="polite">
            {THEME_OPTIONS.find(option => option.id === selectedTheme)?.name ?? 'Custom'}
          </span>
        </div>
        {THEME_COLLECTIONS.map(collection => (
          <div className="veil-theme-collection" key={collection}>
            <h4>{collection}</h4>
            <div className="veil-theme-collection-grid">
              {THEME_OPTIONS.filter(option => option.collection === collection).map(option => {
                const selected = selectedTheme === option.id;
                return (
                  <button
                    key={option.id}
                    className={`veil-theme-option${selected ? ' is-selected' : ''}`}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${option.name}: ${option.description}${selected ? ', selected' : ''}`}
                    onClick={() => themeManager.setThemePreset(option.id, option.accent)}
                  >
                    <span className="veil-theme-option-preview" style={{ backgroundColor: option.bgHex }} aria-hidden="true">
                      <span style={{ backgroundColor: option.accentHex ?? 'var(--veil-accent-primary)' }} />
                      <span />
                      <span />
                    </span>
                    <span className="veil-theme-option-copy"><strong>{option.name}</strong><small>{option.description}</small></span>
                    {selected && <CheckIcon size={16} className="veil-theme-option-check" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="veil-appearance-section" aria-labelledby="appearance-accent-title">
        <div className="veil-appearance-section-heading">
          <div><h3 id="appearance-accent-title">Accent color</h3><p>Fine-tune buttons and highlights</p></div>
          <span className="veil-appearance-current">{ACCENT_PALETTE.find(color => color.id === preferences.accent)?.label}</span>
        </div>
        <div className="veil-accent-options" role="group" aria-label="Accent color">
          {ACCENT_PALETTE.map(color => {
            const selected = preferences.accent === color.id;
            return (
              <button
                key={color.id}
                className={`veil-accent-option${selected ? ' is-selected' : ''}`}
                type="button"
                aria-label={`${color.label} accent${selected ? ', selected' : ''}`}
                aria-pressed={selected}
                style={{ '--swatch-color': color.primary } as React.CSSProperties}
                onClick={() => themeManager.setAccent(color.id)}
              >
                {selected && <CheckIcon size={15} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="veil-appearance-section" aria-labelledby="appearance-wallpaper-title">
        <div className="veil-appearance-section-heading">
          <div><h3 id="appearance-wallpaper-title">Chat backgrounds</h3><p>From minimal to a little more playful</p></div>
        </div>
        <div className="veil-wallpaper-grid">
          {WALLPAPERS.map(wallpaper => {
            const selected = preferences.wallpaper === wallpaper.id;
            return (
              <button
                key={wallpaper.id}
                className={`veil-wallpaper-option${selected ? ' is-selected' : ''}`}
                type="button"
                aria-pressed={selected}
                aria-label={`${wallpaper.name}: ${wallpaper.description}${selected ? ', selected' : ''}`}
                onClick={() => themeManager.setWallpaper(wallpaper.id)}
              >
                <span className={`veil-wallpaper-sample veil-wallpaper-pattern--${wallpaper.id}`} aria-hidden="true" />
                <strong>{wallpaper.name}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <div className="veil-appearance-controls">
        <fieldset className="veil-appearance-section veil-appearance-fieldset">
          <legend>Message shape</legend>
          <p>Choose the feel of each conversation</p>
          <div className="veil-appearance-segmented">
            {BUBBLE_STYLES.map(style => (
              <button
                key={style.id}
                type="button"
                aria-pressed={preferences.bubbleStyle === style.id}
                className={preferences.bubbleStyle === style.id ? 'is-selected' : ''}
                onClick={() => themeManager.setBubbleStyle(style.id as BubbleStyle)}
              >{style.name}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="veil-appearance-section veil-appearance-fieldset">
          <legend>Text size</legend>
          <p>Set a comfortable reading size</p>
          <div className="veil-appearance-segmented">
            {FONT_SIZES.map(size => (
              <button
                key={size.id}
                type="button"
                aria-pressed={preferences.fontSize === size.id}
                className={preferences.fontSize === size.id ? 'is-selected' : ''}
                onClick={() => themeManager.setFontSize(size.id as FontSizeSetting)}
              >{size.name}</button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
};
