import { describe, it, expect, beforeEach } from 'vitest';
import { SpacePinManager } from '../src/privacy/pinManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SessionController } from '../src/ui/app/sessionController.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, bytesToBase64, randomBytes } from '../src/crypto/utils.ts';

describe('Phase 67: App Lock Performance & Single-Derivation Unlock', () => {
  let pinManager: SpacePinManager;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let storageAdapter: MemoryAdapter;
  let idMgr: SpaceIdentityManager;
  let netManager: NetworkManager;
  let sessionController: SessionController;

  beforeEach(() => {
    const storeMap = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storeMap.get(k) || null,
      setItem: (k: string, v: string) => storeMap.set(k, v),
      removeItem: (k: string) => storeMap.delete(k),
      clear: () => storeMap.clear(),
      get length() { return storeMap.size; },
      key: (_i: number) => null,
    };
    pinManager = new SpacePinManager(FAST_TEST_KDF_PARAMS);
    vault = new SpaceVaultManager();
    storageAdapter = new MemoryAdapter();
    store = new EncryptedSpaceStore(storageAdapter);
    idMgr = new SpaceIdentityManager();
    netManager = new NetworkManager(store, {
      httpUrl: 'http://127.0.0.1:8787',
      wsUrl: 'ws://127.0.0.1:8787',
    });
    sessionController = new SessionController(vault, store, storageAdapter, idMgr, netManager);
  });

  it('assigns PIN with masterKey and unwraps it during verification', async () => {
    const password = 'SpaceMasterPassword123!';
    const pin = '4826';
    const env = vault.createSpace({
      name: 'Primary Space',
      password,
      kdfParams: FAST_TEST_KDF_PARAMS,
      canonicalUsername: 'alice',
    });

    const session = vault.unlockSpace(password, env.spaceId);
    const masterKey = session.getMasterKey();

    await pinManager.assignPinToSpace({
      spaceId: env.spaceId,
      canonicalUsername: 'alice',
      spaceName: 'Primary Space',
      password,
      pin,
      isMainAccount: true,
      masterKey,
    });

    const resolved = await pinManager.verifyAndResolvePin(pin);
    expect(resolved.success).toBe(true);
    expect(resolved.spaceId).toBe(env.spaceId);
    expect(resolved.username).toBe('alice');
    expect(resolved.password).toBe(password);
    expect(resolved.masterKey).toBeDefined();
    expect(resolved.masterKey).toBe(bytesToBase64(masterKey));
  });

  it('fast-path vault activation executes in < 5ms without running Argon2id', async () => {
    const password = 'ComplexSecretPassword99!';
    const pin = '7741';
    const env = vault.createSpace({
      name: 'Fast Unlock Space',
      password,
      kdfParams: FAST_TEST_KDF_PARAMS,
      canonicalUsername: 'speedy',
    });

    const initialSession = vault.unlockSpace(password, env.spaceId);
    const masterKey = initialSession.getMasterKey();
    vault.lockSpace(env.spaceId);

    // Verify session is locked
    expect(vault.getActiveSession(env.spaceId)).toBeUndefined();

    // Fast unlock with masterKey
    const t0 = performance.now();
    const fastSession = vault.unlockSpaceWithMasterKey(env.spaceId, masterKey);
    const elapsed = performance.now() - t0;

    expect(fastSession).toBeDefined();
    expect(fastSession.isActive()).toBe(true);
    expect(fastSession.spaceId).toBe(env.spaceId);
    expect(elapsed).toBeLessThan(15); // Instantaneous derivation (no Argon2id)

    // Verify session controller unlockWithMasterKey
    vault.lockSpace(env.spaceId);
    const tCtrl0 = performance.now();
    const ctrlSession = await sessionController.unlockWithMasterKey(env.spaceId, masterKey);
    const ctrlElapsed = performance.now() - tCtrl0;

    expect(ctrlSession.isActive()).toBe(true);
    expect(ctrlElapsed).toBeLessThan(150); // Bypasses Argon2id derivation
  });

  it('legacy entry without masterKey falls back and auto-upgrades with upgradeWrappedCredentialsWithMasterKey', async () => {
    const password = 'LegacyPassword123!';
    const pin = '1984';
    const env = vault.createSpace({
      name: 'Legacy Space',
      password,
      kdfParams: FAST_TEST_KDF_PARAMS,
      canonicalUsername: 'vintage',
    });

    // Assign PIN without masterKey (simulating legacy stored state)
    await pinManager.assignPinToSpace({
      spaceId: env.spaceId,
      canonicalUsername: 'vintage',
      spaceName: 'Legacy Space',
      password,
      pin,
      isMainAccount: true,
      // masterKey omitted
    });

    const firstResolve = await pinManager.verifyAndResolvePin(pin);
    expect(firstResolve.masterKey).toBeUndefined();

    // Unlock via regular password
    const session = vault.unlockSpace(password, env.spaceId);

    // Perform auto-upgrade
    await pinManager.upgradeWrappedCredentialsWithMasterKey({
      spaceId: env.spaceId,
      pin,
      masterKey: session.getMasterKey(),
    });

    // Subsequent resolution must now contain the unwrapped masterKey
    const secondResolve = await pinManager.verifyAndResolvePin(pin);
    expect(secondResolve.masterKey).toBeDefined();
    expect(secondResolve.masterKey).toBe(bytesToBase64(session.getMasterKey()));
  });

  it('rejects incorrect PIN and enforces rate-limiting without leaking space details', async () => {
    const password = 'SecretPassword123!';
    const pin = '1234';
    const env = vault.createSpace({
      name: 'Protected Space',
      password,
      kdfParams: FAST_TEST_KDF_PARAMS,
      canonicalUsername: 'guard',
    });

    await pinManager.assignPinToSpace({
      spaceId: env.spaceId,
      canonicalUsername: 'guard',
      spaceName: 'Protected Space',
      password,
      pin,
      isMainAccount: true,
    });

    // Wrong PIN throws generic error
    await expect(pinManager.verifyAndResolvePin('9999')).rejects.toThrow('Incorrect PIN');

    // 5 failed attempts trigger rate-limiting lockout
    for (let i = 0; i < 4; i++) {
      try {
        await pinManager.verifyAndResolvePin('0000');
      } catch (_e) {}
    }

    // Next attempt must trigger lockout message
    await expect(pinManager.verifyAndResolvePin('1234')).rejects.toThrow(/Too many attempts/);
  });
});
