import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { UIStateManager } from '../src/privacy/uiStateManager.ts';
import { LockManager } from '../src/privacy/lockManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 7: Quick Lock Tests', () => {
  let vault: SpaceVaultManager;
  let uiState: UIStateManager;
  let lockMgr: LockManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    uiState = new UIStateManager();
    lockMgr = new LockManager(vault, uiState);
  });

  it('QUICK LOCK: Locks only the active Space and leaves other Spaces untouched', () => {
    const mainHeader = vault.createSpace({ name: 'Main', password: 'PassMain123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const workHeader = vault.createSpace({ name: 'Work', password: 'PassWork123!', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessMain = lockMgr.unlockSpace('PassMain123!', mainHeader.spaceId);
    const sessWork = lockMgr.unlockSpace('PassWork123!', workHeader.spaceId);

    uiState.registerSensitiveContent(mainHeader.spaceId, 'msg_01', 'message');
    uiState.registerSensitiveContent(workHeader.spaceId, 'msg_02', 'message');

    // Quick Lock ONLY Main Space
    lockMgr.quickLock(mainHeader.spaceId);

    // Main Space is locked and UI state is cleared
    expect(sessMain.isActive()).toBe(false);
    expect(lockMgr.getLockState(mainHeader.spaceId)).toBe('LOCKED');
    expect(uiState.isContentExposed(mainHeader.spaceId)).toBe(false);

    // Work Space remains unlocked and its UI state intact
    expect(sessWork.isActive()).toBe(true);
    expect(lockMgr.getLockState(workHeader.spaceId)).toBe('UNLOCKED');
    expect(uiState.isContentExposed(workHeader.spaceId)).toBe(true);
  });
});
