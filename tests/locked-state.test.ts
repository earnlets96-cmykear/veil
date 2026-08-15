import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { UIStateManager } from '../src/privacy/uiStateManager.ts';
import { LockManager } from '../src/privacy/lockManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 7: Locked-State UI Clearing Tests', () => {
  let vault: SpaceVaultManager;
  let uiState: UIStateManager;
  let lockMgr: LockManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    uiState = new UIStateManager();
    lockMgr = new LockManager(vault, uiState);
  });

  it('LOCKED STATE: Wipes conversation messages, drafts, previews, and clipboard tracking upon lock', () => {
    const header = vault.createSpace({ name: 'Private Vault', password: 'SecretPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = lockMgr.unlockSpace('SecretPassword123!', header.spaceId);

    // Register active sensitive elements
    uiState.registerSensitiveContent(header.spaceId, 'conv_alice_01', 'message');
    uiState.registerSensitiveContent(header.spaceId, 'draft_msg_01', 'draft');
    uiState.registerSensitiveContent(header.spaceId, 'media_thumb_01', 'media_preview');
    uiState.trackClipboard(header.spaceId, 'Temporary copied text');
    uiState.indexSearchKeyword(header.spaceId, 'projectepsilon');

    expect(uiState.getSensitiveCount(header.spaceId)).toBe(3);
    expect(uiState.isContentExposed(header.spaceId)).toBe(true);
    expect(uiState.searchKeywords(header.spaceId, 'epsilon')).toEqual(['projectepsilon']);

    // Perform Quick Lock
    lockMgr.quickLock(header.spaceId);

    // Verify all UI state is cleared
    expect(uiState.getSensitiveCount(header.spaceId)).toBe(0);
    expect(uiState.isContentExposed(header.spaceId)).toBe(false);
    expect(uiState.searchKeywords(header.spaceId, 'epsilon')).toEqual([]);
    expect(sess.isActive()).toBe(false);
  });
});
