import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeManager, ACCENT_PALETTE, BUBBLE_PALETTES, THEME_OPTIONS, WALLPAPERS } from '../src/ui/utils/themeManager.ts';
import { getWallpapersForFamily, WALLPAPER_CATALOG, WALLPAPER_FAMILIES } from '../src/ui/utils/wallpaperCatalog.ts';

describe('ThemeManager — Centralized Dynamic Accent & Theme System', () => {
  let manager: ThemeManager;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    manager = new ThemeManager();
  });

  it('initializes with default dark theme and teal accent', () => {
    const prefs = manager.getPreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs.accent).toBe('teal');
    expect(prefs.bubbleStyle).toBe('modern');
    expect(prefs.bubblePalette).toBe('veil');
    expect(prefs.fontSize).toBe('default');
  });

  it('offers six opaque, high-contrast paired bubble palettes', () => {
    expect(BUBBLE_PALETTES.map(({ id }) => id)).toEqual([
      'deep-sea', 'arctic', 'evergreen', 'ember', 'amethyst', 'rosewood',
    ]);

    const contrast = (foreground: string, background: string) => {
      const luminance = (hex: string) => {
        const channels = hex.match(/[a-f\d]{2}/gi)!.map(channel => parseInt(channel, 16) / 255);
        const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };

    for (const palette of BUBBLE_PALETTES) {
      for (const mode of [palette.dark, palette.light]) {
        for (const role of [mode.incoming, mode.outgoing]) {
          expect(role.background).toMatch(/^#[\da-f]{6}$/i);
          expect(role.text).toMatch(/^#[\da-f]{6}$/i);
          expect(role.border).toMatch(/^#[\da-f]{6}$/i);
          expect(contrast(role.text, role.background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('persists selected bubble palettes independently from theme, accent, and shape', () => {
    const attributes = new Map<string, string>();
    const styles = new Map<string, string>();
    const element = {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      getAttribute: (name: string) => attributes.get(name) ?? null,
      style: {
        setProperty: (name: string, value: string) => styles.set(name, value),
        removeProperty: (name: string) => styles.delete(name),
      },
    };
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: element } });

    manager.setAccent('amber');
    manager.setTheme('porcelain');
    manager.setBubbleStyle('classic');
    manager.setBubblePalette('deep-sea');

    expect(manager.getPreferences()).toMatchObject({
      theme: 'porcelain', accent: 'amber', bubbleStyle: 'classic', bubblePalette: 'deep-sea',
    });
    expect(attributes.get('data-bubble-palette')).toBe('deep-sea');
    expect(styles.get('--veil-bubble-outgoing')).toBe('#b8e4df');
    expect(styles.get('--veil-bubble-incoming')).toBe('#edf8f6');
    manager.setAccent('rose');
    expect(styles.get('--veil-bubble-outgoing')).toBe('#b8e4df');
    expect(new ThemeManager().getBubblePalette()).toBe('deep-sea');
    manager.setBubblePalette('veil');
    expect(styles.has('--veil-bubble-incoming')).toBe(false);
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('falls back to the VEIL bubble palette for unknown saved IDs', () => {
    const entries = new Map<string, string>([['veil:bubble_palette', 'unknown']]);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
        clear: () => entries.clear(),
      },
    });
    expect(new ThemeManager().getBubblePalette()).toBe('veil');
  });

  it('updates accent color and notifies subscribers', () => {
    let notifiedAccent = '';
    const unsub = manager.subscribe((prefs) => {
      notifiedAccent = prefs.accent;
    });

    manager.setAccent('amber');
    expect(manager.getPreferences().accent).toBe('amber');
    expect(notifiedAccent).toBe('amber');

    unsub();
  });

  it('supports all 11 defined accent choices', () => {
    const expectedAccents = [
      'teal', 'cyan', 'blue', 'green', 'lime',
      'amber', 'orange', 'red', 'rose', 'violet', 'gray'
    ];

    expect(ACCENT_PALETTE.map(a => a.id)).toEqual(expectedAccents);

    for (const accent of expectedAccents) {
      manager.setAccent(accent as any);
      expect(manager.getPreferences().accent).toBe(accent);
    }
  });

  it('supports themes: dark, amoled, dim, light', () => {
    manager.setTheme('amoled');
    expect(manager.getPreferences().theme).toBe('amoled');

    manager.setTheme('dim');
    expect(manager.getPreferences().theme).toBe('dim');

    manager.setTheme('light');
    expect(manager.getPreferences().theme).toBe('light');

    manager.setTheme('dark');
    expect(manager.getPreferences().theme).toBe('dark');
  });

  it('organizes premium themes into collections with coordinated preview accents', () => {
    expect(THEME_OPTIONS.map(({ id, collection, accentHex }) => [id, collection, accentHex])).toEqual(
      expect.arrayContaining([
        ['midnight', 'Minimal', '#14b8a6'],
        ['porcelain', 'Minimal', '#a65f32'],
        ['ocean', 'Nature', '#3b82f6'],
        ['forest', 'Nature', '#22c55e'],
        ['rose', 'Expressive', '#f43f5e'],
      ])
    );
  });

  it('provides Glacier, Canyon, and Aurora as one additional preset per collection', () => {
    expect(THEME_OPTIONS.filter(({ id }) => ['glacier', 'canyon', 'aurora'].includes(id))).toHaveLength(3);
    expect(THEME_OPTIONS.find(({ id }) => id === 'glacier')?.collection).toBe('Minimal');
    expect(THEME_OPTIONS.find(({ id }) => id === 'canyon')?.collection).toBe('Nature');
    expect(THEME_OPTIONS.find(({ id }) => id === 'aurora')?.collection).toBe('Expressive');
  });

  it('provides at least two bundled, offline wallpaper choices in every family', () => {
    for (const family of WALLPAPER_FAMILIES) {
      expect(getWallpapersForFamily(family).length).toBeGreaterThanOrEqual(2);
    }
    expect(WALLPAPER_CATALOG.every(({ patternClass }) => patternClass.startsWith('veil-wallpaper-'))).toBe(true);
    expect(WALLPAPER_CATALOG.some(({ patternClass }) => /^https?:/.test(patternClass))).toBe(false);
  });

  it('remembers the last built-in wallpaper when custom wallpaper is selected', () => {
    manager.setWallpaper('orbit');
    manager.setWallpaper('custom');
    expect(manager.getLastBuiltInWallpaper()).toBe('orbit');
    manager.restoreLastBuiltInWallpaper();
    expect(manager.getWallpaper()).toBe('orbit');
  });

  it('offers distinct minimal and expressive chat wallpaper patterns', () => {
    expect(WALLPAPERS.map(({ id }) => id)).toEqual([
      'default', 'solid', 'subtle-patterns', 'waves', 'orbit', 'organic',
      'nature-misty-pines', 'nature-desert-dusk', 'abstract-aurora-glow', 'abstract-rosewater', 'pattern-soft-grid', 'pattern-contours',
    ]);
  });

  it('persists newly selected wallpaper choices across manager instances', () => {
    manager.setWallpaper('waves');
    expect(new ThemeManager().getWallpaper()).toBe('waves');
  });

  it('restores the custom wallpaper selection across manager instances', () => {
    manager.setWallpaper('custom');
    expect(new ThemeManager().getWallpaper()).toBe('custom');
  });

  it('applies a coordinated theme preset and accent in one update', () => {
    manager.setThemePreset('porcelain', 'amber');
    expect(manager.getPreferences().theme).toBe('porcelain');
    expect(manager.getPreferences().accent).toBe('amber');
  });

  it('resets every appearance preference and notifies subscribers', () => {
    manager.setTheme('porcelain');
    manager.setAccent('rose');
    manager.setWallpaper('orbit');
    manager.setBubbleStyle('classic');
    manager.setBubblePalette('rosewood');
    manager.setFontSize('large');
    let notifiedTheme = '';
    manager.subscribe((prefs) => { notifiedTheme = prefs.theme; });

    manager.resetToDefaults();

    expect(manager.getPreferences()).toEqual({
      theme: 'dark', accent: 'teal', wallpaper: 'default', bubbleStyle: 'modern', bubblePalette: 'veil', fontSize: 'default',
    });
    expect(notifiedTheme).toBe('dark');
  });

  it('persists preferences and restores across new instances', () => {
    manager.setTheme('amoled');
    manager.setAccent('rose');
    manager.setBubbleStyle('classic');
    manager.setBubblePalette('arctic');
    manager.setFontSize('large');
    manager.setWallpaper('subtle-patterns');

    // Create fresh instance simulating app reboot
    const freshManager = new ThemeManager();
    const restored = freshManager.getPreferences();

    expect(restored.theme).toBe('amoled');
    expect(restored.accent).toBe('rose');
    expect(restored.bubbleStyle).toBe('classic');
    expect(restored.bubblePalette).toBe('arctic');
    expect(restored.fontSize).toBe('large');
    expect(restored.wallpaper).toBe('subtle-patterns');
  });
});
