/**
 * VEIL Centralized Theme & Appearance Manager.
 *
 * Implements:
 * - Dynamic accent color system (11 options: Teal, Cyan, Blue, Green, Lime, Amber, Orange, Red, Rose, Violet, Gray)
 * - 4 distinct themes: Dark (Default), AMOLED, Dim, Light
 * - Wallpapers, bubble styles (Modern, Classic), and font size scaling
 * - Immediate attribute reflection on document.documentElement
 * - Persistent storage surviving app restart, app lock, and account switching
 */

export type ThemeMode =
  | 'midnight'
  | 'ocean'
  | 'forest'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'dark'
  | 'amoled'
  | 'dim'
  | 'light';

export type AccentColor =
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'green'
  | 'lime'
  | 'amber'
  | 'orange'
  | 'red'
  | 'rose'
  | 'violet'
  | 'gray';

export type ChatWallpaper = 'default' | 'solid' | 'subtle-patterns';
export type WallpaperOption = ChatWallpaper;
export type BubbleStyle = 'modern' | 'classic';
export type FontSizeSetting = 'small' | 'default' | 'large';
export type FontSizeOption = FontSizeSetting;

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  description: string;
  bgHex: string;
  accentHex?: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'midnight', name: 'Midnight', description: 'Deep navy & black VEIL dark mode', bgHex: '#080b11', accentHex: '#14b8a6' },
  { id: 'ocean', name: 'Ocean', description: 'Deep marine blue encrypted tones', bgHex: '#08101a', accentHex: '#3b82f6' },
  { id: 'forest', name: 'Forest', description: 'Deep emerald pine dark surfaces', bgHex: '#07130e', accentHex: '#22c55e' },
  { id: 'amber', name: 'Amber', description: 'Warm obsidian dark charcoal', bgHex: '#120e0a', accentHex: '#f59e0b' },
  { id: 'rose', name: 'Rose', description: 'Deep velvet burgundy dark surfaces', bgHex: '#13090e', accentHex: '#f43f5e' },
  { id: 'slate', name: 'Slate', description: 'Neutral graphite slate dark finish', bgHex: '#0c0d10', accentHex: '#94a3b8' },
  { id: 'amoled', name: 'AMOLED', description: 'Pure black background (#000000) for OLED battery savings', bgHex: '#000000' },
  { id: 'light', name: 'Light', description: 'High-contrast clean light mode', bgHex: '#f8fafc' },
];

export const BUBBLE_STYLES: Array<{ id: BubbleStyle; name: string; description: string }> = [
  { id: 'modern', name: 'Modern Rounded', description: 'Curved responsive corners with subtle borders' },
  { id: 'classic', name: 'Classic Compact', description: 'Tight angles with high information density' },
];

export const FONT_SIZES: Array<{ id: FontSizeSetting; name: string; description: string; scale?: string }> = [
  { id: 'small', name: 'Small', description: 'Compact 90% scaling', scale: '0.9' },
  { id: 'default', name: 'Default', description: 'Standard 100% typography', scale: '1.0' },
  { id: 'large', name: 'Large', description: 'Comfortable 110% scaling', scale: '1.1' },
];

export const WALLPAPERS: Array<{ id: ChatWallpaper; name: string; description: string }> = [
  { id: 'default', name: 'Deep Charcoal', description: 'Clean minimalist matte finish' },
  { id: 'solid', name: 'Solid Midnight', description: 'Pure monochromatic backdrop' },
  { id: 'subtle-patterns', name: 'Subtle Patterns', description: 'Discrete encrypted-grid texture' },
];

export interface AccentDefinition {
  id: AccentColor;
  label: string;
  name?: string;
  primary: string;
  hex?: string;
  hover: string;
  hoverHex?: string;
  subtle: string;
  subtleBg?: string;
  alpha: string;
  borderSubtle?: string;
}

export const ACCENT_PALETTE: AccentDefinition[] = [
  { id: 'teal', label: 'Teal', name: 'Teal', primary: '#14b8a6', hex: '#14b8a6', hover: '#0d9488', hoverHex: '#0d9488', subtle: 'rgba(20, 184, 166, 0.12)', subtleBg: 'rgba(20, 184, 166, 0.12)', alpha: 'rgba(20, 184, 166, 0.25)', borderSubtle: 'rgba(20, 184, 166, 0.25)' },
  { id: 'cyan', label: 'Cyan', name: 'Cyan', primary: '#06b6d4', hex: '#06b6d4', hover: '#0891b2', hoverHex: '#0891b2', subtle: 'rgba(6, 182, 212, 0.12)', subtleBg: 'rgba(6, 182, 212, 0.12)', alpha: 'rgba(6, 182, 212, 0.25)', borderSubtle: 'rgba(6, 182, 212, 0.25)' },
  { id: 'blue', label: 'Blue', name: 'Blue', primary: '#3b82f6', hex: '#3b82f6', hover: '#2563eb', hoverHex: '#2563eb', subtle: 'rgba(59, 130, 246, 0.12)', subtleBg: 'rgba(59, 130, 246, 0.12)', alpha: 'rgba(59, 130, 246, 0.25)', borderSubtle: 'rgba(59, 130, 246, 0.25)' },
  { id: 'green', label: 'Green', name: 'Green', primary: '#22c55e', hex: '#22c55e', hover: '#16a34a', hoverHex: '#16a34a', subtle: 'rgba(34, 197, 94, 0.12)', subtleBg: 'rgba(34, 197, 94, 0.12)', alpha: 'rgba(34, 197, 94, 0.25)', borderSubtle: 'rgba(34, 197, 94, 0.25)' },
  { id: 'lime', label: 'Lime', name: 'Lime', primary: '#84cc16', hex: '#84cc16', hover: '#65a30d', hoverHex: '#65a30d', subtle: 'rgba(132, 204, 22, 0.12)', subtleBg: 'rgba(132, 204, 22, 0.12)', alpha: 'rgba(132, 204, 22, 0.25)', borderSubtle: 'rgba(132, 204, 22, 0.25)' },
  { id: 'amber', label: 'Amber', name: 'Amber', primary: '#f59e0b', hex: '#f59e0b', hover: '#d97706', hoverHex: '#d97706', subtle: 'rgba(245, 158, 11, 0.12)', subtleBg: 'rgba(245, 158, 11, 0.12)', alpha: 'rgba(245, 158, 11, 0.25)', borderSubtle: 'rgba(245, 158, 11, 0.25)' },
  { id: 'orange', label: 'Orange', name: 'Orange', primary: '#f97316', hex: '#f97316', hover: '#ea580c', hoverHex: '#ea580c', subtle: 'rgba(249, 115, 22, 0.12)', subtleBg: 'rgba(249, 115, 22, 0.12)', alpha: 'rgba(249, 115, 22, 0.25)', borderSubtle: 'rgba(249, 115, 22, 0.25)' },
  { id: 'red', label: 'Red', name: 'Red', primary: '#ef4444', hex: '#ef4444', hover: '#dc2626', hoverHex: '#dc2626', subtle: 'rgba(239, 68, 68, 0.12)', subtleBg: 'rgba(239, 68, 68, 0.12)', alpha: 'rgba(239, 68, 68, 0.25)', borderSubtle: 'rgba(239, 68, 68, 0.25)' },
  { id: 'rose', label: 'Rose', name: 'Rose', primary: '#f43f5e', hex: '#f43f5e', hover: '#e11d48', hoverHex: '#e11d48', subtle: 'rgba(244, 63, 94, 0.12)', subtleBg: 'rgba(244, 63, 94, 0.12)', alpha: 'rgba(244, 63, 94, 0.25)', borderSubtle: 'rgba(244, 63, 94, 0.25)' },
  { id: 'violet', label: 'Violet', name: 'Violet', primary: '#8b5cf6', hex: '#8b5cf6', hover: '#7c3aed', hoverHex: '#7c3aed', subtle: 'rgba(139, 92, 246, 0.12)', subtleBg: 'rgba(139, 92, 246, 0.12)', alpha: 'rgba(139, 92, 246, 0.25)', borderSubtle: 'rgba(139, 92, 246, 0.25)' },
  { id: 'gray', label: 'Gray', name: 'Gray', primary: '#94a3b8', hex: '#94a3b8', hover: '#64748b', hoverHex: '#64748b', subtle: 'rgba(148, 163, 184, 0.12)', subtleBg: 'rgba(148, 163, 184, 0.12)', alpha: 'rgba(148, 163, 184, 0.25)', borderSubtle: 'rgba(148, 163, 184, 0.25)' },
];

export interface AppearancePreferences {
  theme: ThemeMode;
  accent: AccentColor;
  wallpaper: ChatWallpaper;
  bubbleStyle: BubbleStyle;
  fontSize: FontSizeSetting;
}

const STORAGE_KEYS = {
  theme: 'veil:theme',
  accent: 'veil:accent',
  wallpaper: 'veil:wallpaper',
  bubbleStyle: 'veil:bubble_style',
  fontSize: 'veil:font_size',
};

// In-memory fallback for test runner & SSR
const memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(key);
    } catch (_e) {}
  }
  return memoryStorage[key] || null;
}

function setStorageItem(key: string, val: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, val);
    } catch (_e) {}
  }
  memoryStorage[key] = val;
}

export class ThemeManager {
  private prefs: AppearancePreferences;
  private listeners: Array<(prefs: AppearancePreferences) => void> = [];

  constructor() {
    this.prefs = this.loadPreferences();
    this.applyToDOM();
  }

  private loadPreferences(): AppearancePreferences {
    let theme: ThemeMode = 'dark';
    let accent: AccentColor = 'teal';
    let wallpaper: ChatWallpaper = 'default';
    let bubbleStyle: BubbleStyle = 'modern';
    let fontSize: FontSizeSetting = 'default';

    const savedTheme = getStorageItem(STORAGE_KEYS.theme) as ThemeMode;
    const validThemes: ThemeMode[] = ['midnight', 'ocean', 'forest', 'amber', 'rose', 'slate', 'dark', 'amoled', 'dim', 'light'];
    if (savedTheme && validThemes.includes(savedTheme)) {
      theme = savedTheme;
    }

    const savedAccent = getStorageItem(STORAGE_KEYS.accent) as AccentColor;
    if (savedAccent && ACCENT_PALETTE.some(a => a.id === savedAccent)) {
      accent = savedAccent;
    }

    const savedWall = getStorageItem(STORAGE_KEYS.wallpaper) as ChatWallpaper;
    if (savedWall === 'default' || savedWall === 'solid' || savedWall === 'subtle-patterns') {
      wallpaper = savedWall;
    }

    const savedBubble = getStorageItem(STORAGE_KEYS.bubbleStyle) as BubbleStyle;
    if (savedBubble === 'modern' || savedBubble === 'classic') {
      bubbleStyle = savedBubble;
    }

    const savedSize = getStorageItem(STORAGE_KEYS.fontSize) as FontSizeSetting;
    if (savedSize === 'small' || savedSize === 'default' || savedSize === 'large') {
      fontSize = savedSize;
    }

    return { theme, accent, wallpaper, bubbleStyle, fontSize };
  }

  public getPreferences(): AppearancePreferences {
    return { ...this.prefs };
  }

  public setTheme(theme: ThemeMode): void {
    this.prefs.theme = theme;
    setStorageItem(STORAGE_KEYS.theme, theme);
    this.applyToDOM();
    this.notify();
  }

  public setAccent(accent: AccentColor): void {
    this.prefs.accent = accent;
    setStorageItem(STORAGE_KEYS.accent, accent);
    this.applyToDOM();
    this.notify();
  }

  public setWallpaper(wallpaper: ChatWallpaper): void {
    this.prefs.wallpaper = wallpaper;
    setStorageItem(STORAGE_KEYS.wallpaper, wallpaper);
    this.applyToDOM();
    this.notify();
  }

  public setBubbleStyle(bubbleStyle: BubbleStyle): void {
    this.prefs.bubbleStyle = bubbleStyle;
    setStorageItem(STORAGE_KEYS.bubbleStyle, bubbleStyle);
    this.applyToDOM();
    this.notify();
  }

  public setFontSize(fontSize: FontSizeSetting): void {
    this.prefs.fontSize = fontSize;
    setStorageItem(STORAGE_KEYS.fontSize, fontSize);
    this.applyToDOM();
    this.notify();
  }

  public getTheme(): ThemeMode {
    return this.prefs.theme;
  }

  public getAccent(): AccentColor {
    return this.prefs.accent;
  }

  public getWallpaper(): ChatWallpaper {
    return this.prefs.wallpaper;
  }

  public getBubbleStyle(): BubbleStyle {
    return this.prefs.bubbleStyle;
  }

  public getFontSize(): FontSizeSetting {
    return this.prefs.fontSize;
  }

  public applyTheme(): void {
    this.applyToDOM();
  }

  /**
   * Applies active preferences as data attributes and CSS variables on document.documentElement.
   */
  public applyToDOM(): void {
    if (typeof document === 'undefined' || !document.documentElement) return;

    const root = document.documentElement;
    root.setAttribute('data-theme', this.prefs.theme);
    root.setAttribute('data-accent', this.prefs.accent);
    root.setAttribute('data-bubble-style', this.prefs.bubbleStyle);
    root.setAttribute('data-font-size', this.prefs.fontSize);
    root.setAttribute('data-wallpaper', this.prefs.wallpaper);

    // Find accent definition
    const activeAccent = ACCENT_PALETTE.find(a => a.id === this.prefs.accent) || ACCENT_PALETTE[0];
    root.style.setProperty('--veil-accent-primary', activeAccent.primary);
    root.style.setProperty('--veil-accent-primary-hover', activeAccent.hover);
    root.style.setProperty('--veil-accent-primary-subtle', activeAccent.subtle);
    root.style.setProperty('--veil-accent-primary-alpha', activeAccent.alpha);
  }

  public subscribe(listener: (prefs: AppearancePreferences) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    const prefs = this.getPreferences();
    for (const listener of this.listeners) {
      try {
        listener(prefs);
      } catch (_e) {}
    }
  }
}

// Global Singleton Instance
export const themeManager = new ThemeManager();
