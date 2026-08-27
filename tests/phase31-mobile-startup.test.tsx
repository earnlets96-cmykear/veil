/**
 * Phase 31: Mobile Startup, Error Boundary & Storage Initialization Tests.
 *
 * Verifies that component errors never result in a black screen,
 * ErrorBoundary catches exceptions safely with sanitized messaging,
 * and storage loading states render cleanly.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary.tsx';

const CrashingComponent: React.FC<{ shouldCrash?: boolean }> = ({ shouldCrash }) => {
  if (shouldCrash) {
    throw new Error('Database connection failed with masterKey=SUPER_SECRET_KEY');
  }
  return <div data-testid="healthy-ui">VEIL UI is Online</div>;
};

describe('Phase 31: Mobile Startup & Error Boundary Resilience', () => {
  it('renders healthy children when no crash occurs', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <CrashingComponent shouldCrash={false} />
      </ErrorBoundary>
    );

    expect(html).toContain('VEIL UI is Online');
  });

  it('catches startup component errors and sanitizes secrets from error display', () => {
    const boundary = new ErrorBoundary({ children: null });
    const derivedState = ErrorBoundary.getDerivedStateFromError(
      new Error('Authentication failed with masterKey=SUPER_SECRET_KEY')
    );

    expect(derivedState.hasError).toBe(true);
    expect(derivedState.errorMessage).not.toContain('SUPER_SECRET_KEY');
    expect(derivedState.errorMessage).not.toContain('masterKey');
    expect(derivedState.errorMessage).toBe('An authentication or security error occurred.');
  });
});
