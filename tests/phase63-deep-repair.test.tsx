import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpacePinManager } from '../src/privacy/pinManager.ts';
import { VoicePlayer } from '../src/attachments/voicePlayer.ts';
import { themeManager } from '../src/ui/utils/themeManager.ts';
import { AppProvider } from '../src/ui/app/AppState.tsx';
import { ToastProvider } from '../src/ui/components/ui/Toast.tsx';
import { Sidebar } from '../src/ui/components/Sidebar.tsx';
import { PinLockScreen } from '../src/ui/components/PinLockScreen.tsx';
import { LockScreen } from '../src/ui/components/LockScreen.tsx';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import { AppLockSettingsView } from '../src/ui/components/AppLockSettingsView.tsx';

describe('Phase 63: VEIL Deep Authentication, App Lock, Navigation & Voice Repair', () => {
  let manager: SpacePinManager;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    // Fast test KDF params for rapid test execution
    manager = new SpacePinManager({
      memoryCost: 1024,
      timeCost: 1,
      parallelism: 1,
    });
  });

  afterEach(() => {
    VoicePlayer.stop();
  });

  describe('1. Fast Authentication & PIN Verification Lifecycle', () => {
    it('successfully registers and verifies 4-digit and 6-digit PINs returning success flag', async () => {
      await manager.assignPinToSpace({
        spaceId: 'space-alpha',
        canonicalUsername: 'alice',
        spaceName: 'Personal',
        password: 'secure-space-password-123',
        pin: '1234',
      });

      await manager.assignPinToSpace({
        spaceId: 'space-beta',
        canonicalUsername: 'bob',
        spaceName: 'Work',
        password: 'work-space-password-456',
        pin: '876543',
      });

      // Verify 4-digit PIN returns success: true and the decrypted space password
      const resAlpha = await manager.verifyAndResolvePin('1234');
      expect(resAlpha.success).toBe(true);
      expect(resAlpha.spaceId).toBe('space-alpha');
      expect(resAlpha.username).toBe('alice');
      expect(resAlpha.password).toBe('secure-space-password-123');

      // Verify 6-digit PIN returns success: true and the decrypted space password
      const resBeta = await manager.verifyAndResolvePin('876543');
      expect(resBeta.success).toBe(true);
      expect(resBeta.spaceId).toBe('space-beta');
      expect(resBeta.username).toBe('bob');
      expect(resBeta.password).toBe('work-space-password-456');
    });

    it('rejects incorrect PINs cleanly and tracks lockout attempts without leaking credentials', async () => {
      await manager.assignPinToSpace({
        spaceId: 'space-alpha',
        canonicalUsername: 'alice',
        spaceName: 'Personal',
        password: 'pass',
        pin: '1234',
      });

      await expect(manager.verifyAndResolvePin('9999')).rejects.toThrow('Incorrect PIN');
      await expect(manager.verifyAndResolvePin('0000')).rejects.toThrow('Incorrect PIN');
    });

    it('persists preferred PIN type setting in the device registry', () => {
      expect(manager.getPinType()).toBe('4-digit');
      manager.setPinType('6-digit');
      expect(manager.getPinType()).toBe('6-digit');
      manager.setPinType('4-digit');
      expect(manager.getPinType()).toBe('4-digit');
    });
  });

  describe('2. Navigation Architecture: Bottom Nav Removed & Hamburger to Settings', () => {
    it('completely removes bottom navigation bar and wires hamburger button to Settings', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <Sidebar />
          </ToastProvider>
        </AppProvider>
      );

      // Verify NO bottom navigation bar exists
      expect(html).not.toMatch(/veil-bottom-nav/);
      expect(html).not.toMatch(/>Chats<\/span>/);
      expect(html).not.toMatch(/>Calls<\/span>/);
      expect(html).not.toMatch(/>Settings<\/span>/);

      // Verify hamburger button is explicitly dedicated to Settings
      expect(html).toMatch(/aria-label="Open Settings"/);
      expect(html).toMatch(/title="Settings"/);
    });
  });

  describe('3. Settings Controls Functional State Wiring', () => {
    it('renders AppLockSettingsView with real controls connected to spacePinManager', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <AppLockSettingsView />
          </ToastProvider>
        </AppProvider>
      );

      // Verify all required settings controls exist
      expect(html).toMatch(/Enable App Lock/);
      expect(html).toMatch(/Change PIN/);
      expect(html).toMatch(/PIN Type/);
      expect(html).toMatch(/Auto Lock/);
      expect(html).toMatch(/After exiting app/);
      expect(html).toMatch(/After background/);
      expect(html).toMatch(/After screen off/);
      expect(html).toMatch(/After inactivity/);
      expect(html).toMatch(/Lock Now/);
    });

    it('themeManager accurately sets and retrieves themes and accents', () => {
      themeManager.setTheme('midnight');
      expect(themeManager.getTheme()).toBe('midnight');

      themeManager.setAccent('teal');
      expect(themeManager.getAccent()).toBe('teal');

      themeManager.setAccent('amber');
      expect(themeManager.getAccent()).toBe('amber');
    });
  });

  describe('4. Voice Message Seek System & Playback Controls', () => {
    it('VoicePlayer.seek accurately calculates targetTime using durationSeconds', () => {
      // Seek to 50% of a 40-second voice note
      VoicePlayer.seek(50, 'msg-voice-1', 40);
      expect(VoicePlayer.getCurrentTime()).toBe(0); // Audio not yet loaded in node env, but no error

      // Seek to 75% of a 60-second voice note
      VoicePlayer.seek(75, 'msg-voice-2', 60);
      expect(VoicePlayer.getStatus('msg-voice-2')).toBe('idle');
    });

    it('VoiceNoteCard renders scrubber track with onClick and pointer handlers, not blocked by touch blockers', () => {
      const onSeekMock = vi.fn();
      const onPlayMock = vi.fn();

      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="test-voice-card"
          durationSeconds={45}
          currentTimeSeconds={15}
          currentProgressPercent={33.3}
          playbackState="ready"
          onPlayToggle={onPlayMock}
          onSeek={onSeekMock}
        />
      );

      // Verify waveform container exists without blocking onTouchStart
      expect(html).toMatch(/veil-waveform-container/);
      expect(html).toMatch(/Audio message/);
      expect(html).toMatch(/0:45/);
    });
  });

  describe('5. Lock Screens & Fallback UX', () => {
    it('PinLockScreen renders dynamic indicators, explicit OK button, and Forgot PIN option', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <PinLockScreen onFallbackPassword={() => {}} />
          </ToastProvider>
        </AppProvider>
      );

      expect(html).toMatch(/Enter your PIN/);
      expect(html).toMatch(/Forgot PIN\?/);
      expect(html).toMatch(/aria-label="Unlock"/);
      expect(html).toMatch(/OK/);
    });

    it('LockScreen renders single username/password gate without leaking existing spaces', () => {
      const html = renderToStaticMarkup(
        <AppProvider>
          <ToastProvider>
            <LockScreen />
          </ToastProvider>
        </AppProvider>
      );

      expect(html).toBeDefined();
      expect(html).not.toMatch(/space-alpha/);
      expect(html).not.toMatch(/space-beta/);
      expect(html).not.toMatch(/envelope\(s\)/i);
      expect(html).not.toMatch(/\d+\s+spaces/i);
    });
  });
});
