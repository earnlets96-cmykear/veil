import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppearanceSettingsView } from '../src/ui/components/AppearanceSettingsView.tsx';

describe('Appearance wallpaper controls', () => {
  it('renders all wallpaper families and an accessible local photo upload', () => {
    const markup = renderToStaticMarkup(<AppearanceSettingsView />);
    expect(markup).toContain('Nature');
    expect(markup).toContain('Abstract');
    expect(markup).toContain('Patterns');
    expect(markup).toContain('Misty Pines');
    expect(markup).toContain('Desert Dusk');
    expect(markup).toContain('Aurora Glow');
    expect(markup).toContain('Rosewater');
    expect(markup).toContain('Soft Grid');
    expect(markup).toContain('Contour Lines');
    expect(markup).toContain('Upload photo');
    expect(markup).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(markup).toContain('not encrypted by VEIL Spaces');
  });

  it('includes the Glacier, Canyon, and Aurora presets', () => {
    const markup = renderToStaticMarkup(<AppearanceSettingsView />);
    expect(markup).toContain('Glacier');
    expect(markup).toContain('Canyon');
    expect(markup).toContain('Aurora');
  });
});
