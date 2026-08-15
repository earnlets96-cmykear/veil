import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { DeviceManager } from '../src/device/deviceManager.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 15: Device Production Lifecycle & Revocation Tests', () => {
  let vault: SpaceVaultManager;
  let adapter: MemoryStorageAdapter;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let devManager: DeviceManager;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
    idMgr = new SpaceIdentityManager();
    devManager = new DeviceManager(store, idMgr);
  });

  it('DEVICE REGISTRATION & REVOCATION: Enrolls second device and revokes it cleanly', async () => {
    const env = vault.createSpace({ name: 'Personal', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);
    idMgr.createIdentity(session, store);

    // Primary device registry
    const registry = devManager.getOrCreateRegistry(session, 'primary_device');
    expect(registry.devices['primary_device']).toBeDefined();

    // Register secondary device
    devManager.registerDevice(session, {
      deviceId: 'secondary_laptop',
      deviceName: 'Secondary Laptop',
      deviceSigningPub: 'dummy_sign_key',
      deviceKeyAgreementPub: 'dummy_ka_key',
      enrolledAt: Date.now(),
      enrolledByDeviceId: 'primary_device',
      status: 'ACTIVE',
      authorizationSignature: 'auth_sig',
    });

    let activeDevices = devManager.getActiveDevices(session);
    expect(activeDevices).toHaveLength(2);

    // Revoke secondary device
    devManager.revokeDevice(session, 'secondary_laptop', 'primary_device');
    activeDevices = devManager.getActiveDevices(session);
    expect(activeDevices).toHaveLength(1);
    expect(devManager.isDeviceAuthorized(session, 'secondary_laptop')).toBe(false);
  });
});
