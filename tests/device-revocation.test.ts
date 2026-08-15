import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { DeviceManager } from '../src/device/deviceManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 6: Device Revocation & Authorization Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let devMgr: DeviceManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    devMgr = new DeviceManager(store, idMgr);
  });

  it('should register secondary device and revoke it with signed revocation record', () => {
    vault.createSpace({ name: 'Work', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const sess = vault.unlockSpace('Pass1');
    idMgr.createIdentity(sess, store);

    // 1. Initial registry has primary device
    const reg1 = devMgr.getOrCreateRegistry(sess, 'primary_device');
    expect(reg1.devices['primary_device']).toBeDefined();
    expect(devMgr.isDeviceAuthorized(sess, 'primary_device')).toBe(true);

    // 2. Register secondary device
    devMgr.registerDevice(sess, {
      deviceId: 'secondary_tablet',
      deviceName: 'Alice iPad',
      deviceSigningPub: 'base64Pub',
      deviceKeyAgreementPub: 'base64KAPub',
      enrolledAt: Date.now(),
      enrolledByDeviceId: 'primary_device',
      status: 'ACTIVE',
      authorizationSignature: 'base64Sig',
    });

    expect(devMgr.isDeviceAuthorized(sess, 'secondary_tablet')).toBe(true);
    expect(devMgr.getActiveDevices(sess).length).toBe(2);

    // 3. Revoke secondary device
    const revRecord = devMgr.revokeDevice(sess, 'secondary_tablet', 'primary_device');
    expect(revRecord.targetDeviceId).toBe('secondary_tablet');
    expect(revRecord.signature).toBeTruthy();

    // 4. Verify secondary device is no longer authorized
    expect(devMgr.isDeviceAuthorized(sess, 'secondary_tablet')).toBe(false);
    expect(devMgr.getActiveDevices(sess).length).toBe(1);

    // 5. Attempt to re-register revoked device fails
    expect(() =>
      devMgr.registerDevice(sess, {
        deviceId: 'secondary_tablet',
        deviceName: 'Alice iPad (Attacker Re-register)',
        deviceSigningPub: 'base64Pub',
        deviceKeyAgreementPub: 'base64KAPub',
        enrolledAt: Date.now(),
        enrolledByDeviceId: 'primary_device',
        status: 'ACTIVE',
        authorizationSignature: 'base64Sig',
      })
    ).toThrow(/device has been revoked/);
  });
});
