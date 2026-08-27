/**
 * Top-Level React Error Boundary for VEIL.
 *
 * Catches unhandled component errors, prevents black-screen crashes,
 * sanitizes error messages to prevent secret/key leakage, and provides
 * recovery actions (Retry, Continue Offline).
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Sanitize error message to ensure no secrets/keys are displayed
    const rawMsg = error?.message || 'An unexpected application error occurred.';
    const lower = rawMsg.toLowerCase();
    let msg = rawMsg;
    if (
      lower.includes('passphrase') ||
      lower.includes('masterkey') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('password')
    ) {
      msg = 'An authentication or security error occurred.';
    }
    return {
      hasError: true,
      errorMessage: msg,
    };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[VEIL-ERROR-BOUNDARY] Component error caught:', error?.name, error?.message);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleContinueOffline = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            background: 'radial-gradient(ellipse at top, #141b2d 0%, #090c13 100%)',
            color: '#f8fafc',
            fontFamily: 'var(--veil-font-sans, system-ui, -apple-system, sans-serif)',
            padding: '1.5rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="veil-card-glass"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                color: '#ffffff',
                boxShadow: '0 0 24px rgba(239, 68, 68, 0.4)',
                marginBottom: '1.25rem',
              }}
            >
              ⚠️
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: '0.5rem',
                color: '#f8fafc',
              }}
            >
              VEIL Startup Recovery
            </h1>

            <p
              style={{
                color: '#94a3b8',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                marginBottom: '1.5rem',
              }}
            >
              The application encountered an unexpected issue while loading. Your local encrypted data remains secure and untouched on this device.
            </p>

            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.75rem',
                textAlign: 'left',
                marginBottom: '1.5rem',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
              }}
            >
              {this.state.errorMessage}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={this.handleRetry}
                className="veil-btn veil-btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                🔄 Retry Loading
              </button>

              <button
                type="button"
                onClick={this.handleContinueOffline}
                className="veil-btn veil-btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                📱 Return to Lock Screen
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
