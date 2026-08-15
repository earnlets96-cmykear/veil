import { describe, it, expect, vi } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 1: Security & Sensitive Logging Audit Tests', () => {
  it('should never leak passwords, master keys, or plaintexts to console outputs or error messages', () => {
    const logSpy = vi.spyOn(console, 'log');
    const warnSpy = vi.spyOn(console, 'warn');
    const errorSpy = vi.spyOn(console, 'error');

    const vault = new SpaceVaultManager();
    const sensitivePassword = 'UltraTopSecretPassword_XYZ_999';

    // 1. Create Space
    const env = vault.createSpace({
      name: 'Audit Space',
      password: sensitivePassword,
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Unlock Space
    const session = vault.unlockSpace(sensitivePassword);
    const storageKeyHex = Array.from(session.getStorageKey())
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 3. Trigger failed unlock with sensitive candidate
    let caughtError: Error | null = null;
    try {
      vault.unlockSpace('AnotherSecretGuessPassword_123');
    } catch (e: any) {
      caughtError = e;
    }

    // 4. Change password
    const newPassword = 'NewSecretPassword_ABC_888';
    vault.changePassword(env.spaceId, sensitivePassword, newPassword, FAST_TEST_KDF_PARAMS);

    // 5. Inspect all collected log streams
    const allLoggedContent = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ].map(item => String(item));

    // Verify sensitive passwords do NOT appear in logs
    for (const log of allLoggedContent) {
      expect(log).not.toContain(sensitivePassword);
      expect(log).not.toContain('AnotherSecretGuessPassword_123');
      expect(log).not.toContain(newPassword);
      expect(log).not.toContain(storageKeyHex);
    }

    // Verify error message is generic and does not leak secrets
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).not.toContain('AnotherSecretGuessPassword_123');
    expect(caughtError!.message).not.toContain(sensitivePassword);
    expect(caughtError!.message).toBe('Unable to unlock Space: invalid credentials or corrupted envelope');

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
