import React, { useEffect, useRef, useState } from 'react';
import {
  ACCENT_PALETTE,
  BUBBLE_PALETTES,
  BUBBLE_STYLES,
  FONT_SIZES,
  THEME_OPTIONS,
  WALLPAPERS,
  themeManager,
  type AppearancePreferences,
  type BubblePaletteId,
  type BubbleStyle,
  type FontSizeSetting,
} from '../utils/themeManager.ts';
import { getWallpapersForFamily, WALLPAPER_FAMILIES } from '../utils/wallpaperCatalog.ts';
import { normalizeCustomWallpaper } from '../utils/customWallpaperImage.ts';
import { customWallpaperManager } from '../utils/customWallpaperManager.ts';
import { customWallpaperStore } from '../utils/customWallpaperStore.ts';
import { ArrowLeftIcon, CheckIcon } from './icons/index.ts';

interface AppearanceSettingsViewProps {
  onBack?: () => void;
}

const THEME_COLLECTIONS = ['Minimal', 'Nature', 'Expressive'] as const;
const BUBBLE_PALETTE_IDS: BubblePaletteId[] = ['veil', ...BUBBLE_PALETTES.map(({ id }) => id)];

export const AppearanceSettingsView: React.FC<AppearanceSettingsViewProps> = ({ onBack }) => {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => themeManager.getPreferences());
  const [notice, setNotice] = useState('');
  const [wallpaperError, setWallpaperError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [hasSavedPhoto, setHasSavedPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const curatedWallpaperIds = new Set(['nature-misty-pines', 'nature-desert-dusk', 'abstract-aurora-glow', 'abstract-rosewater', 'pattern-soft-grid', 'pattern-contours']);
  const currentCuratedWallpaper = WALLPAPER_FAMILIES.flatMap(getWallpapersForFamily).find(item => item.wallpaperId === preferences.wallpaper);
  const selectedTheme = preferences.theme === 'dark'
    ? 'midnight'
    : preferences.theme === 'dim'
      ? 'slate'
      : preferences.theme;

  useEffect(() => themeManager.subscribe(setPreferences), []);
  useEffect(() => {
    let active = true;
    void customWallpaperStore.load().then(blob => { if (active) setHasSavedPhoto(Boolean(blob)); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const handleReset = () => {
    themeManager.resetToDefaults();
    setNotice('Default appearance restored.');
  };

  const handleWallpaperUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setWallpaperError('');
    setUploading(true);
    try {
      const blob = await normalizeCustomWallpaper(file);
      await customWallpaperManager.replace(blob);
      setHasSavedPhoto(true);
    } catch (error) {
      setWallpaperError(error instanceof Error ? error.message : 'The wallpaper could not be saved.');
    } finally {
      setUploading(false);
    }
  };

  const chooseBuiltInWallpaper = (wallpaperId: typeof WALLPAPERS[number]['id']) => {
    setWallpaperError('');
    themeManager.setWallpaper(wallpaperId);
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
          className={`veil-appearance-preview veil-wallpaper-pattern--${preferences.wallpaper}${currentCuratedWallpaper ? ` ${currentCuratedWallpaper.patternClass}` : ''}`}
          data-wallpaper={preferences.wallpaper}
          data-bubble-style={preferences.bubbleStyle}
          data-bubble-palette={preferences.bubblePalette}
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

      <section className="veil-appearance-section" aria-labelledby="appearance-bubble-palette-title">
        <div className="veil-appearance-section-heading">
          <div><h3 id="appearance-bubble-palette-title">Bubble palette</h3><p>Pair incoming and outgoing colors</p></div>
          <span className="veil-appearance-current" aria-live="polite">
            {preferences.bubblePalette === 'veil' ? 'VEIL Default' : BUBBLE_PALETTES.find(({ id }) => id === preferences.bubblePalette)?.name}
          </span>
        </div>
        <div className="veil-bubble-palette-grid" role="group" aria-label="Message bubble palette">
          {BUBBLE_PALETTE_IDS.map((paletteId) => {
            const palette = BUBBLE_PALETTES.find(({ id }) => id === paletteId);
            const isLightTheme = ['light', 'porcelain', 'glacier'].includes(preferences.theme);
            const surfaces = isLightTheme ? palette?.light : palette?.dark;
            const selected = preferences.bubblePalette === paletteId;
            const paletteName = palette?.name ?? 'VEIL Default';
            return (
              <button
                key={paletteId}
                type="button"
                aria-label={`${paletteName} bubble palette${selected ? ', selected' : ''}`}
                aria-pressed={selected}
                className={`veil-bubble-palette-option${selected ? ' is-selected' : ''}`}
                onClick={() => themeManager.setBubblePalette(paletteId)}
              >
                <span className="veil-bubble-palette-samples" aria-hidden="true">
                  <span
                    className="veil-bubble-palette-sample is-incoming"
                    style={surfaces ? {
                      '--sample-background': surfaces.incoming.background,
                      '--sample-text': surfaces.incoming.text,
                      '--sample-border': surfaces.incoming.border,
                    } as React.CSSProperties : undefined}
                  >Incoming</span>
                  <span
                    className="veil-bubble-palette-sample is-outgoing"
                    style={surfaces ? {
                      '--sample-background': surfaces.outgoing.background,
                      '--sample-text': surfaces.outgoing.text,
                      '--sample-border': surfaces.outgoing.border,
                    } as React.CSSProperties : undefined}
                  >Outgoing</span>
                </span>
                <span className="veil-bubble-palette-copy"><strong>{paletteName}</strong><small>{palette?.description ?? 'Use your current accent colors'}</small></span>
                {selected && <CheckIcon size={16} className="veil-theme-option-check" />}
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
          {WALLPAPERS.filter(wallpaper => !curatedWallpaperIds.has(wallpaper.id)).map(wallpaper => {
            const selected = preferences.wallpaper === wallpaper.id;
            return (
              <button
                key={wallpaper.id}
                className={`veil-wallpaper-option${selected ? ' is-selected' : ''}`}
                type="button"
                aria-pressed={selected}
                aria-label={`${wallpaper.name}: ${wallpaper.description}${selected ? ', selected' : ''}`}
                onClick={() => chooseBuiltInWallpaper(wallpaper.id)}
              >
                <span className={`veil-wallpaper-sample veil-wallpaper-pattern--${wallpaper.id}`} aria-hidden="true" />
                <strong>{wallpaper.name}</strong>
              </button>
            );
          })}
        </div>
        {WALLPAPER_FAMILIES.map(family => (
          <div className="veil-wallpaper-family" key={family}>
            <h4>{family}</h4>
            <div className="veil-wallpaper-grid">
              {getWallpapersForFamily(family).map(wallpaper => {
                const selected = preferences.wallpaper === wallpaper.wallpaperId;
                return (
                  <button
                    key={wallpaper.id}
                    className={`veil-wallpaper-option${selected ? ' is-selected' : ''}`}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${wallpaper.name}: ${wallpaper.description}${selected ? ', selected' : ''}`}
                    onClick={() => chooseBuiltInWallpaper(wallpaper.wallpaperId)}
                  >
                    <span className={`veil-wallpaper-sample ${wallpaper.patternClass}`} aria-hidden="true" />
                    <strong>{wallpaper.name}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="veil-wallpaper-upload">
          <input ref={fileInputRef} className="veil-wallpaper-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a wallpaper photo" onChange={handleWallpaperUpload} />
          <button type="button" className="veil-appearance-upload-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Processing photo…' : preferences.wallpaper === 'custom' ? 'Change photo' : 'Upload photo'}
          </button>
          {hasSavedPhoto && preferences.wallpaper !== 'custom' && <button type="button" className="veil-appearance-remove-button" onClick={() => void customWallpaperManager.selectSaved().catch(error => setWallpaperError(error instanceof Error ? error.message : 'The photo could not be selected.'))}>Use uploaded photo</button>}
          {hasSavedPhoto && <button type="button" className="veil-appearance-remove-button" onClick={() => void customWallpaperManager.remove().then(() => setHasSavedPhoto(false)).catch(error => setWallpaperError(error instanceof Error ? error.message : 'The wallpaper could not be removed.'))}>Remove photo</button>}
          <p>Your photo stays on this device in local app storage. It is not encrypted by VEIL Spaces, uploaded, or synced.</p>
          {wallpaperError && <p className="veil-wallpaper-error" role="alert">{wallpaperError}</p>}
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
