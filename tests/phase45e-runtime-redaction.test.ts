import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';

describe('Phase 45E: Diagnostic Telemetry Redaction & Safety', () => {
  beforeEach(() => {
    RuntimeDiagnostics.clear();
  });

  it('1. records diagnostic events safely without leaking plain secrets or keys', () => {
    RuntimeDiagnostics.audio('seekRequested', {
      duration: 120,
      seekRequested: 50,
      targetTime: 60,
      actualCurrentTime: 60,
      audioActive: true,
      messageId: 'msg_test_123',
    });

    RuntimeDiagnostics.video('seekExecuted', {
      targetPercent: 25,
      targetSeconds: 30,
      actualCurrentTime: 30,
      duration: 120,
    });

    const entries = RuntimeDiagnostics.getEntries();
    expect(entries.length).toBe(2);

    for (const entry of entries) {
      const json = JSON.stringify(entry);
      expect(json).not.toContain('encryptionKey');
      expect(json).not.toContain('masterKey');
      expect(json).not.toContain('password');
      expect(json).not.toContain('privateKey');
    }
  });

  it('2. truncates long diagnostic history to prevent memory leaks', () => {
    for (let i = 0; i < 600; i++) {
      RuntimeDiagnostics.audio('timeUpdate', { index: i });
    }

    const entries = RuntimeDiagnostics.getEntries();
    expect(entries.length).toBeLessThanOrEqual(500);
  });
});
