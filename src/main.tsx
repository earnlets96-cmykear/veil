/**
 * VEIL Application Bootstrap Entrypoint.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './ui/components/ErrorBoundary.tsx';
import { AppProvider } from './ui/app/AppState.tsx';
import { ToastProvider } from './ui/components/ui/index.ts';
import { App } from './ui/App.tsx';
import './styles/themes.css';
import './styles/veil-design-system.css';
import './styles/veil-components.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <AppProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

