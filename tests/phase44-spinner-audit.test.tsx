import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Spinner, LoadingSpinner } from '../src/ui/components/ui/index.ts';

describe('Phase 44: Minimal Premium CSS Spinner Audit Suite', () => {
  it('renders minimal CSS spinner with correct sizing classes and accessibility attributes', () => {
    const htmlXs = renderToStaticMarkup(<Spinner size="xs" aria-label="Loading tiny" />);
    expect(htmlXs).toContain('veil-spinner');
    expect(htmlXs).toContain('veil-spinner-xs');
    expect(htmlXs).toContain('role="status"');
    expect(htmlXs).toContain('aria-label="Loading tiny"');

    const htmlSm = renderToStaticMarkup(<Spinner size="sm" />);
    expect(htmlSm).toContain('veil-spinner-sm');

    const htmlMd = renderToStaticMarkup(<Spinner size="md" />);
    expect(htmlMd).toContain('veil-spinner-md');

    const htmlLg = renderToStaticMarkup(<Spinner size="lg" />);
    expect(htmlLg).toContain('veil-spinner-lg');
  });

  it('renders LoadingSpinner wrapper cleanly with custom color and role without raw SVGs', () => {
    const html = renderToStaticMarkup(<LoadingSpinner size="sm" color="#3b82f6" label="Custom loading" />);
    expect(html).toContain('veil-spinner-sm');
    expect(html).toContain('aria-label="Custom loading"');
    // Ensure no raw SVG element exists
    expect(html).not.toContain('<svg');
  });
});
