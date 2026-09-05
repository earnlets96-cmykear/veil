import React, { useState, useEffect } from 'react';
import {
  themeManager,
  ACCENT_PALETTE,
  THEME_OPTIONS,
  BUBBLE_STYLES,
  FONT_SIZES,
  WALLPAPERS,
  AccentColor,
  ThemeMode,
  BubbleStyle,
  FontSizeOption,
  WallpaperOption,
} from '../utils/themeManager.ts';
import { ArrowLeftIcon } from './icons/index.ts';

interface AppearanceSettingsViewProps {
  onBack?: () => void;
}

export const AppearanceSettingsView: React.FC<AppearanceSettingsViewProps> = ({ onBack }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => themeManager.getTheme());
  const [currentAccent, setCurrentAccent] = useState<AccentColor>(() => themeManager.getAccent());
  const [currentBubble, setCurrentBubble] = useState<BubbleStyle>(() => themeManager.getBubbleStyle());
  const [currentFontSize, setCurrentFontSize] = useState<FontSizeOption>(() => themeManager.getFontSize());
  const [currentWallpaper, setCurrentWallpaper] = useState<WallpaperOption>(() => themeManager.getWallpaper());

  useEffect(() => {
    const unsub = themeManager.subscribe((settings) => {
      setCurrentTheme(settings.theme);
      setCurrentAccent(settings.accent);
      setCurrentBubble(settings.bubbleStyle);
      setCurrentFontSize(settings.fontSize);
      setCurrentWallpaper(settings.wallpaper);
    });
    return unsub;
  }, []);

  const handleSelectTheme = (theme: ThemeMode) => {
    themeManager.setTheme(theme);
    setCurrentTheme(theme);
  };

  const handleSelectAccent = (accent: AccentColor) => {
    themeManager.setAccent(accent);
    setCurrentAccent(accent);
  };

  const handleSelectBubble = (style: BubbleStyle) => {
    themeManager.setBubbleStyle(style);
    setCurrentBubble(style);
  };

  const handleSelectFontSize = (size: FontSizeOption) => {
    themeManager.setFontSize(size);
    setCurrentFontSize(size);
  };

  const handleSelectWallpaper = (wp: WallpaperOption) => {
    themeManager.setWallpaper(wp);
    setCurrentWallpaper(wp);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {onBack && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          Appearance & Themes
        </h2>
        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #94a3b8)' }}>
          Customize your VEIL client visual style, palette, bubble layout, and density.
        </p>
      </div>

      {/* Theme Modes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
          Color Scheme
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {THEME_OPTIONS.map((opt) => {
            const isSelected = currentTheme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelectTheme(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--border-color, #272a34)'}`,
                  backgroundColor: isSelected ? 'rgba(20, 184, 166, 0.08)' : 'var(--bg-secondary, #15171c)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: opt.bgHex,
                    border: '1px solid var(--border-color, #272a34)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--accent-color, #14b8a6)' : '#64748b',
                    }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--text-primary, #f8fafc)',
                    }}
                  >
                    {opt.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                    {opt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Colors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Accent Color
          </div>
          <div style={{ fontSize: '12px', color: 'var(--accent-color, #14b8a6)', fontWeight: 500 }}>
            {ACCENT_PALETTE.find((a) => a.id === currentAccent)?.name}
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--bg-secondary, #15171c)',
            border: '1px solid var(--border-color, #272a34)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          {ACCENT_PALETTE.map((acc) => {
            const isSelected = currentAccent === acc.id;
            return (
              <button
                key={acc.id}
                onClick={() => handleSelectAccent(acc.id)}
                title={acc.name}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: acc.hex,
                  border: isSelected ? '3px solid #ffffff' : '2px solid transparent',
                  boxShadow: isSelected ? `0 0 0 2px ${acc.hex}` : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Message Bubble Preview & Style */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
          Message Bubble Style
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {BUBBLE_STYLES.map((style) => {
            const isSelected = currentBubble === style.id;
            return (
              <button
                key={style.id}
                onClick={() => handleSelectBubble(style.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--border-color, #272a34)'}`,
                  backgroundColor: isSelected ? 'rgba(20, 184, 166, 0.08)' : 'var(--bg-secondary, #15171c)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--text-primary, #f8fafc)',
                  }}
                >
                  {style.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                  {style.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Bubble Preview */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary, #15171c)',
            border: '1px solid var(--border-color, #272a34)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary, #1f222a)',
                border: '1px solid var(--border-color, #272a34)',
                color: 'var(--text-primary, #f8fafc)',
                padding: '8px 12px',
                borderRadius: currentBubble === 'modern' ? '14px 14px 14px 4px' : '8px 8px 8px 2px',
                fontSize: '13px',
                maxWidth: '75%',
              }}
            >
              How does the new VEIL interface look?
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                backgroundColor: 'var(--accent-color, #14b8a6)',
                color: '#ffffff',
                padding: '8px 12px',
                borderRadius: currentBubble === 'modern' ? '14px 14px 4px 14px' : '8px 8px 2px 8px',
                fontSize: '13px',
                maxWidth: '75%',
              }}
            >
              Clean, neutral charcoal surfaces with no purple gradients.
            </div>
          </div>
        </div>
      </div>

      {/* Font Size Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
          Font Size
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {FONT_SIZES.map((fs) => {
            const isSelected = currentFontSize === fs.id;
            return (
              <button
                key={fs.id}
                onClick={() => handleSelectFontSize(fs.id)}
                style={{
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: `1.5px solid ${isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--border-color, #272a34)'}`,
                  backgroundColor: isSelected ? 'rgba(20, 184, 166, 0.08)' : 'var(--bg-secondary, #15171c)',
                  color: isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--text-primary, #f8fafc)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{fs.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                  {fs.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Wallpaper */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
          Chat Wallpaper Texture
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {WALLPAPERS.map((wp) => {
            const isSelected = currentWallpaper === wp.id;
            return (
              <button
                key={wp.id}
                onClick={() => handleSelectWallpaper(wp.id)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--border-color, #272a34)'}`,
                  backgroundColor: isSelected ? 'rgba(20, 184, 166, 0.1)' : 'var(--bg-secondary, #15171c)',
                  color: isSelected ? 'var(--accent-color, #14b8a6)' : 'var(--text-secondary, #94a3b8)',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {wp.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
