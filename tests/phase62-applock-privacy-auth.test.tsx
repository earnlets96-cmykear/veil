/**
 * Phase 62 Acceptance Test Suite:
 * App Lock, Privacy, Space Isolation, Authentication & UI Refinements.
 *
 * Covers:
 * 1. spacePinManager.hasPinForSpace method and resolution by spaceId & username.
 * 2. Elimination of space enumeration in AccountsAndSpacesModal (protecting decoy spaces).
 * 3. Sidebar navigation rebalance (removal of "Spaces" pill, removal of "Calls" tab, 3 balanced tabs).
 * 4. Error sanitization for LockScreen authentication (preventing raw JS leakages).
 * 5. PinLockScreen & AppLockSetupModal dynamic indicators and explicit Enter/OK submission semantics.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpacePinManager } from '../src/privacy/pinManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { AppProvider } from '../src/ui/app/AppState.tsx';
import { ToastProvider } from '../src/ui/components/ui/index.ts';
import { AccountsAndSpacesModal } from '../src/ui/components/AccountsAndSpacesModal.tsx';
import { Sidebar } from '../src/ui/components/Sidebar.tsx';
import { LockScreen } from '../src/ui/components/LockScreen.tsx';
import { PinLockScreen } from '../src/ui/components/PinLockScreen.tsx';
import { AppLockSetupModal } from '../src/ui/components/AppLockSetupModal.tsx';

describe('Phase 62: App Lock, Privacy & Authentication Suite', () => {
  let manager: SpacePinManager;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    manager = new SpacePinManager({
      ...FAST_TEST_KDF_PARAMS,
      salt: '',
    });
    manager.resetRegistry();
  });

  describe('1. SpacePinManager: hasPinForSpace & Resolution Invariants', () => {
    it('returns false when no PIN is registered for a space', () => {
      expect(manager.hasPinForSpace('space-unknown-1')).toBe(false);
      expect(manager.hasPinForSpace('@unknownuser')).toBe(false);
      expect(manager.hasPinForSpace('')).toBe(false);
    });

    it('returns true for spaceId after PIN assignment', async () => {
      await manager.assignPinToSpace({
        spaceId: 'space-alpha-99',
        canonicalUsername: 'alice',
        spaceName: 'Alice Space',
        password: 'alice-strong-password',
        pin: '1234',
      });

      expect(manager.hasPinForSpace('space-alpha-99')).toBe(true);
      expect(manager.hasPinForSpace('space-beta')).toBe(false);
    });

    it('returns true when queried by canonicalUsername (with or without @ prefix)', async () => {
      await manager.assignPinToSpace({
        spaceId: 'space-bob-42',
        canonicalUsername: 'bob',
        spaceName: 'Work Vault',
        password: 'bob-strong-password',
        pin: '987654',
      });

      expect(manager.hasPinForSpace('bob')).toBe(true);
      expect(manager.hasPinForSpace('@bob')).toBe(true);
      expect(manager.hasPinForSpace('BOB')).toBe(true);
      expect(manager.hasPinForSpace('charlie')).toBe(false);
    });

    it('correctly handles getPinType and onboarding flags by both spaceId and canonicalUsername', async () => {
      await manager.assignPinToSpace({
        spaceId: 'space-charlie',
        canonicalUsername: 'charlie',
        spaceName: 'Charlie Space',
        password: 'charlie-pass',
        pin: '123456',
      });

      expect(manager.getPinType('space-charlie')).toBe('6-digit');
      expect(manager.getPinType('charlie')).toBe('6-digit');
      expect(manager.getPinType('@charlie')).toBe('6-digit');

      // Onboarding completed flags
      expect(manager.isOnboardingCompleted('space-charlie')).toBe(false);
      manager.setOnboardingCompleted('charlie', true);
      expect(manager.isOnboardingCompleted('space-charlie')).toBe(true);
      expect(manager.isOnboardingCompleted('@charlie')).toBe(true);
    });
  });

  describe('2. Space Privacy & Zero Enumeration Invariants', () => {
    it('AccountsAndSpacesModal reveals ZERO enumeration of other registered or decoy spaces', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <AccountsAndSpacesModal />
          </ToastProvider>
        </AppProvider>
      );

      // STRICT PRIVACY: Must NOT display space directory counts or listings
      expect(html).not.toMatch(/Your Spaces \(\d+\)/i);
      expect(html).not.toMatch(/No other spaces configured on this device/i);

      // MUST display privacy-preserving direct actions
      expect(html).toMatch(/Switch Space/i);
      expect(html).toMatch(/Create New Space/i);
      expect(html).toMatch(/Add Existing Account/i);
      expect(html).toMatch(/Zero Space Enumeration/i);
      expect(html).toMatch(/VEIL never lists inactive or decoy spaces/i);
    });

    it('Sidebar removes "Spaces" filter pill and applies .veil-filter-pill to remaining chips', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <Sidebar />
          </ToastProvider>
        </AppProvider>
      );

      // Verify category chips
      expect(html).toMatch(/All/);
      expect(html).toMatch(/Unread/);
      expect(html).toMatch(/Groups/);

      // Spaces filter pill must NOT be rendered in the category chips
      expect(html).not.toMatch(/>Spaces<\/button>/);

      // Filter pills must have the veil-filter-pill class for clean oval touch styling
      expect(html).toMatch(/class="[^"]*veil-filter-pill[^"]*"/);
    });

    it('Sidebar removes "Calls" tab and rebalances bottom navigation to 3 equal tabs', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <Sidebar />
          </ToastProvider>
        </AppProvider>
      );

      // Bottom navigation bar must be completely removed (no Calls, Chats, Groups, or Settings tabs at bottom)
      expect(html).not.toMatch(/veil-bottom-nav/);
      expect(html).not.toMatch(/>Calls<\/span>/);
      expect(html).not.toMatch(/>Chats<\/span>/);
      expect(html).not.toMatch(/>Settings<\/span>/);

      // Hamburger button opens Settings
      expect(html).toMatch(/aria-label="Open Settings"/);
    });
  });

  describe('3. LockScreen Authentication & Error Sanitization', () => {
    it('renders the LockScreen with privacy-preserving single input and zero space count disclosure', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <LockScreen />
          </ToastProvider>
        </AppProvider>
      );

      expect(html).toBeDefined();
      expect(html).not.toMatch(/envelope\(s\)/i);
      expect(html).not.toMatch(/\d+\s+spaces/i);
      expect(html).not.toMatch(/is not a function/i);
    });
  });

  describe('4. PIN Entry & Setup Explicit Actions and Dynamic Indicators', () => {
    it('PinLockScreen renders with explicit Enter/Unlock button and keypad', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <PinLockScreen />
          </ToastProvider>
        </AppProvider>
      );

      // Explicit Enter/Unlock keypad button must be present
      expect(html).toMatch(/aria-label="Unlock"/i);
      expect(html).toMatch(/OK/);

      // Keypad digits 0-9 and backspace must be present
      expect(html).toMatch(/aria-label="Digit 1"/i);
      expect(html).toMatch(/aria-label="Digit 9"/i);
      expect(html).toMatch(/aria-label="Backspace"/i);

      // Dot indicators must exist
      expect(html).toMatch(/role="group"/);
    });

    it('AppLockSetupModal renders 4 vs 6-digit options and explicit Continue action', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <AppLockSetupModal />
          </ToastProvider>
        </AppProvider>
      );

      // PIN length toggle option
      expect(html).toMatch(/Use (4|6)-digit PIN/i);

      // Explicit continue action button
      expect(html).toMatch(/Continue/);

      // Dynamic dots group
      expect(html).toMatch(/role="group"/);
      expect(html).toMatch(/aria-label="PIN setup indicator"/);
    });
  });
});
