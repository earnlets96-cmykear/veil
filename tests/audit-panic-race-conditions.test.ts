import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { UIStateManager } from '../src/privacy/uiStateManager.ts';
import { LockManager } from '../src/privacy/lockManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 9 Red-Team Audit: Panic Lock Concurrency & Session Invalidation', () => {
  it('PANIC LOCK RACE: In-flight session operations immediately fail post-panic lock', () => {
    const vault = new SpaceVaultManager();
    const uiState = new UIStateManager();
    const lockMgr = new LockManager(vault, uiState);
    const store = new EncryptedSpaceStore();

    const h = vault.createSpace({ name: 'Ops', password: 'p1', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = lockMgr.unlockSpace('p1', h.spaceId);

    expect(sess.isActive()).toBe(true);

    // Trigger panic lock
    lockMgr.panicLock();

    // Verify session is dead
    expect(sess.isActive()).toBe(false);

    // Attempting to read/write storage with destroyed session must throw
    expect(() => store.set(sess, 'key', 'val')).toThrow();
    expect(() => store.get(sess, 'key')).toThrow();
  });
});
