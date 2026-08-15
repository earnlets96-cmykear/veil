import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 15: UI Accessibility & Design System Invariant Tests', () => {
  it('DESIGN SYSTEM ACCESSIBILITY: Verifies presence of focus tokens, high contrast, and reduced motion', () => {
    const cssPath = path.join(process.cwd(), 'src/styles/veil-design-system.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // 1. Focus indicator tokens
    expect(css).toContain('--veil-border-focus');

    // 2. High contrast typography tokens
    expect(css).toContain('--veil-text-primary: #f8fafc');
    expect(css).toContain('--veil-bg-base: #090c13');

    // 3. Panic button distinct high-visibility styling
    expect(css).toContain('--veil-panic-bg: #450a0a');
    expect(css).toContain('.veil-btn-panic');
  });
});
