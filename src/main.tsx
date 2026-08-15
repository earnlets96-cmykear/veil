/**
 * VEIL Application Bootstrap Entrypoint.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from './ui/app/AppState.tsx';
import { App } from './ui/App.tsx';
import './styles/veil-design-system.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>
  );
}
