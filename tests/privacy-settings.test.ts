import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { PrivacyManager } from '../src/privacy/privacyManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 7: Privacy Settings Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let privMgr: PrivacyManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    privMgr = new PrivacyManager(store);
  });

  it('should store and update per-Space privacy settings', () => {
    const header = vault.createSpace({ name: 'Work', password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = vault.unlockSpace('Pass!', header.spaceId);

    // Initial default settings (balanced)
    const defaults = privMgr.getSettings(sess);
    expect(defaults.privacyLevel).toBe('balanced');
    expect(defaults.autoLockInterval).toBe('5min');

    // Update to high privacy preset
    const updated = privMgr.updateSettings(sess, { privacyLevel: 'high' });
    expect(updated.privacyLevel).toBe('high');
    expect(updated.autoLockInterval).toBe('1min');
    expect(updated.hideMessagePreviews).toBe(true);

    // Custom overrides
    const customized = privMgr.updateSettings(sess, { screenshotProtection: true, autoLockInterval: '15min' });
    expect(customized.screenshotProtection).toBe(true);
    expect(customized.autoLockInterval).toBe('15min');

    // Reset to defaults
    const reset = privMgr.resetToDefaults(sess);
    expect(reset.privacyLevel).toBe('balanced');
  });
});
