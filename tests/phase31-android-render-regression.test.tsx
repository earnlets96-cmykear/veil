/**
 * Phase 31: Android Startup & AppProvider Render Regression Test Suite
 *
 * Prevents black-screen startup failures caused by Temporal Dead Zone (TDZ)
 * ReferenceErrors, lifecycle dependency ordering violations, and component
 * initialization exceptions.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppProvider, AppContext } from '../src/ui/app/AppState.tsx';
import { ToastProvider } from '../src/ui/components/ui/index.ts';
import { App } from '../src/ui/App.tsx';
import { LockScreen } from '../src/ui/components/LockScreen.tsx';

describe('VEIL Android Startup & React Bootstrap Regression', () => {
  it('mounts AppProvider and App component tree without any TDZ ReferenceErrors', () => {
    // Render the complete production root tree to HTML static markup
    const html = renderToStaticMarkup(
      <AppProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppProvider>
    );

    // Verify it renders cleanly without ReferenceError
    expect(html).toBeDefined();
    expect(html).toContain('Storage Unavailable');
    expect(html).toContain('Retry Initialization');
  });

  it('renders LockScreen cleanly when storage is ready', () => {
    const mockContext: any = {
      storageReady: true,
      storageError: null,
      activeSession: null,
      conversations: [],
      contacts: [],
      contactRequests: [],
      myProfile: null,
      privacySettings: { phoneVisibility: 'contacts', profileVisibility: 'everyone' },
      activeChatId: null,
      messages: {},
      activeModal: null,
      networkState: 'offline',
      knownSpacesCount: 1,
      searchQuery: '',
      searchResults: [],
      replyTarget: null,
      unlockSpace: async () => {},
      createSpace: async () => {},
      lockSpace: () => {},
      panicLock: () => {},
      openModal: () => {},
      closeModal: () => {},
    };

    const html = renderToStaticMarkup(
      <AppContext.Provider value={mockContext}>
        <LockScreen />
      </AppContext.Provider>
    );

    expect(html).toContain('VEIL');
    expect(html).toContain('Unlock Space');
    expect(html).toContain('Enter Space Passphrase');
    expect(html).toContain('type="password"');
  });
});
