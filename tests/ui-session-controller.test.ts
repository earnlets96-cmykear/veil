import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { SessionController } from '../src/ui/app/sessionController.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 14: SessionController & Space Lifecycle Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let adapter: MemoryStorageAdapter;
  let idMgr: SpaceIdentityManager;
  let netManager: NetworkManager;
  let sessionCtrl: SessionController;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();

    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
    idMgr = new SpaceIdentityManager();
    netManager = new NetworkManager(store);

    sessionCtrl = new SessionController(vault, store, adapter, idMgr, netManager);
  });

  it('UNLOCK & CREATION: Creates Space and unlocks with matching credential', async () => {
    const env = vault.createSpace({ name: 'Personal', password: 'Pass123!Secure', kdfParams: FAST_TEST_KDF_PARAMS });
    await vault.saveEnvelopeToStorage(env, adapter);

    const session = await sessionCtrl.unlock('Pass123!Secure');
    expect(session.isActive()).toBe(true);
    expect(session.name).toBe('Personal');
    expect(sessionCtrl.getActiveSession()).toBe(session);
  });

  it('SPACE SWITCHING ISOLATION: Switching Spaces wipes previous session and loads new Space', async () => {
    const envA = vault.createSpace({ name: 'Space A', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    const envB = vault.createSpace({ name: 'Space B', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });
    await vault.saveEnvelopeToStorage(envA, adapter);
    await vault.saveEnvelopeToStorage(envB, adapter);

    const sessionA = await sessionCtrl.unlock('PassA');
    expect(sessionCtrl.getActiveSession()?.name).toBe('Space A');

    // Switch to Space B
    const sessionB = await sessionCtrl.switchSpace('PassB');
    expect(sessionA.isActive()).toBe(false); // Session A destroyed!
    expect(sessionB.isActive()).toBe(true);
    expect(sessionCtrl.getActiveSession()?.name).toBe('Space B');
  });

  it('PANIC LOCK: Instantly wipes session and notifies listeners', async () => {
    const env = vault.createSpace({ name: 'Secret', password: 'SecretPass', kdfParams: FAST_TEST_KDF_PARAMS });
    await vault.saveEnvelopeToStorage(env, adapter);

    const session = await sessionCtrl.unlock('SecretPass');
    expect(session.isActive()).toBe(true);

    let lockNotified = false;
    sessionCtrl.onLock(() => {
      lockNotified = true;
    });

    sessionCtrl.panicLock();
    expect(session.isActive()).toBe(false);
    expect(sessionCtrl.getActiveSession()).toBeNull();
    expect(lockNotified).toBe(true);
  });
});
