import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { UIStateManager } from '../src/privacy/uiStateManager.ts';
import { LockManager } from '../src/privacy/lockManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 7: Panic Lock Tests', () => {
  let vault: SpaceVaultManager;
  let uiState: UIStateManager;
  let lockMgr: LockManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    uiState = new UIStateManager();
    lockMgr = new LockManager(vault, uiState);
  });

  it('PANIC LOCK: Wipes all active sessions and sensitive UI states across all Spaces', () => {
    // 1. Create and unlock Main Space and Private Space
    const mainHeader = vault.createSpace({ name: 'Main', password: 'PassMain123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const privHeader = vault.createSpace({ name: 'Private', password: 'PassPriv123!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessMain = lockMgr.unlockSpace('PassMain123!', mainHeader.spaceId);
    const sessPriv = lockMgr.unlockSpace('PassPriv123!', privHeader.spaceId);

    expect(lockMgr.getLockState(mainHeader.spaceId)).toBe('UNLOCKED');
    expect(lockMgr.getLockState(privHeader.spaceId)).toBe('UNLOCKED');

    // 2. Register sensitive UI components in both Spaces
    uiState.registerSensitiveContent(mainHeader.spaceId, 'msg_01', 'message');
    uiState.registerSensitiveContent(privHeader.spaceId, 'msg_02', 'message');
    uiState.registerSensitiveContent(privHeader.spaceId, 'media_01', 'media_preview');
    uiState.trackClipboard(privHeader.spaceId, 'Sensitive copied text');
    uiState.indexSearchKeyword(privHeader.spaceId, 'supersecretkeyword');

    expect(uiState.isContentExposed(mainHeader.spaceId)).toBe(true);
    expect(uiState.isContentExposed(privHeader.spaceId)).toBe(true);

    // 3. Trigger PANIC LOCK
    lockMgr.panicLock();

    // 4. Verify all sessions are destroyed and marked PANIC_LOCKED
    expect(sessMain.isActive()).toBe(false);
    expect(sessPriv.isActive()).toBe(false);
    expect(lockMgr.getLockState(mainHeader.spaceId)).toBe('PANIC_LOCKED');
    expect(lockMgr.getLockState(privHeader.spaceId)).toBe('PANIC_LOCKED');

    // 5. Verify all sensitive UI content is wiped
    expect(uiState.isContentExposed(mainHeader.spaceId)).toBe(false);
    expect(uiState.isContentExposed(privHeader.spaceId)).toBe(false);
    expect(uiState.searchKeywords(privHeader.spaceId, 'supersecret')).toEqual([]);

    // 6. Verify panic lock did NOT delete the Spaces from disk/envelopes
    expect(vault.listEnvelopes().length).toBe(2);

    // 7. Spaces can be unlocked again with correct credentials
    const reUnlocked = lockMgr.unlockSpace('PassMain123!', mainHeader.spaceId);
    expect(reUnlocked.isActive()).toBe(true);
    expect(lockMgr.getLockState(mainHeader.spaceId)).toBe('UNLOCKED');
  });
});
