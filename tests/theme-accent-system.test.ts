import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeManager, ACCENT_PALETTE } from '../src/ui/utils/themeManager.ts';

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
    expect(prefs.fontSize).toBe('default');
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

  it('persists preferences and restores across new instances', () => {
    manager.setTheme('amoled');
    manager.setAccent('rose');
    manager.setBubbleStyle('classic');
    manager.setFontSize('large');
    manager.setWallpaper('subtle-patterns');

    // Create fresh instance simulating app reboot
    const freshManager = new ThemeManager();
    const restored = freshManager.getPreferences();

    expect(restored.theme).toBe('amoled');
    expect(restored.accent).toBe('rose');
    expect(restored.bubbleStyle).toBe('classic');
    expect(restored.fontSize).toBe('large');
    expect(restored.wallpaper).toBe('subtle-patterns');
  });
});
