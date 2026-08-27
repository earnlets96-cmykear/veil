/**
 * Phase 31: LockScreen Privacy & Account Count Metadata Elimination Tests.
 *
 * Verifies that the LockScreen UI reveals ZERO information about how many
 * protected spaces/accounts or encrypted vault envelopes exist on the device.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppProvider } from '../src/ui/app/AppState.tsx';
import { LockScreen } from '../src/ui/components/LockScreen.tsx';
import { ToastProvider } from '../src/ui/components/ui/index.ts';

describe('Phase 31: LockScreen Privacy & Zero Account Count Exposure', () => {
  it('renders the LockScreen without any account count, envelope count, or space count metadata', () => {
    const html = renderToStaticMarkup(
      <AppProvider>
        <ToastProvider>
          <LockScreen />
        </ToastProvider>
      </AppProvider>
    );

    expect(html).toBeDefined();

    // STRICT INVARIANTS: Zero metadata disclosure on LockScreen
    expect(html).not.toMatch(/encrypted vault envelope/i);
    expect(html).not.toMatch(/envelope\(s\) at rest/i);
    expect(html).not.toMatch(/\d+\s+spaces/i);
    expect(html).not.toMatch(/\d+\s+accounts/i);
    expect(html).not.toMatch(/accounts detected/i);
    expect(html).not.toMatch(/spaces available/i);
  });
});
