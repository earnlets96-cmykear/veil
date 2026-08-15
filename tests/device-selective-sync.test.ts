import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { DeviceEnrollmentManager } from '../src/device/enrollment.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { ed25519 } from '@noble/curves/ed25519.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { bytesToBase64, base64ToBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 6: Selective Space Synchronization Tests', () => {
  let vaultPrimary: SpaceVaultManager;
  let vaultSecondary: SpaceVaultManager;
  let storePrimary: EncryptedSpaceStore;
  let storeSecondary: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vaultPrimary = new SpaceVaultManager();
    vaultSecondary = new SpaceVaultManager();
    storePrimary = new EncryptedSpaceStore();
    storeSecondary = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('SELECTIVE SYNC: Secondary device receives only chosen Space and zero knowledge of unselected Spaces', () => {
    // 1. Primary device creates 3 Spaces
    vaultPrimary.createSpace({ name: 'Main Space', password: 'PassMain', kdfParams: FAST_TEST_KDF_PARAMS });
    vaultPrimary.createSpace({ name: 'Work Space', password: 'PassWork', kdfParams: FAST_TEST_KDF_PARAMS });
    vaultPrimary.createSpace({ name: 'Private Space', password: 'PassPrivate', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessMain = vaultPrimary.unlockSpace('PassMain');
    const sessWork = vaultPrimary.unlockSpace('PassWork');
    const sessPrivate = vaultPrimary.unlockSpace('PassPrivate');

    idMgr.createIdentity(sessMain, storePrimary);
    const idWork = idMgr.createIdentity(sessWork, storePrimary);
    const privWork = idMgr.loadIdentity(sessWork, storePrimary)!;
    idMgr.createIdentity(sessPrivate, storePrimary);

    // 2. User initiates enrollment for ONLY "Work Space"
    const { state: primaryEnrollState } = DeviceEnrollmentManager.createEnrollmentSession(
      'primary_laptop',
      [{ session: sessWork, name: 'Work Space' }]
    );

    // 3. Secondary generates keys
    const secEphemeralPriv = x25519.utils.randomPrivateKey();
    const secEphemeralPub = x25519.getPublicKey(secEphemeralPriv);
    const secSigningPriv = ed25519.utils.randomPrivateKey();
    const secSigningPub = ed25519.getPublicKey(secSigningPriv);
    const secKAPriv = x25519.utils.randomPrivateKey();
    const secKAPub = x25519.getPublicKey(secKAPriv);

    const secondaryDeviceRecord = {
      deviceId: 'secondary_phone',
      deviceName: 'Work iPhone',
      deviceSigningPub: bytesToBase64(secSigningPub),
      deviceKeyAgreementPub: bytesToBase64(secKAPub),
    };

    // 4. Primary completes enrollment
    const primaryRes = DeviceEnrollmentManager.completePrimaryEnrollment(
      primaryEnrollState,
      secEphemeralPub,
      secondaryDeviceRecord,
      privWork.signingPrivateKey
    );

    // 5. Secondary receives and decrypts payload
    const secondaryRes = DeviceEnrollmentManager.receiveSecondaryEnrollment(
      secEphemeralPriv,
      primaryEnrollState.ephemeralPublicKey,
      primaryRes.encryptedTunnelPayload,
      primaryRes.nonce
    );

    // 6. Verify only 1 Space is present in the payload
    expect(secondaryRes.payload.spaces.length).toBe(1);
    expect(secondaryRes.payload.spaces[0].name).toBe('Work Space');
    expect(secondaryRes.payload.spaces[0].spaceId).toBe(sessWork.spaceId);

    // 7. Secondary initializes "Work Space"
    const workMasterKey = base64ToBytes(secondaryRes.payload.spaces[0].masterKeyBase64);
    const secWorkHeader = vaultSecondary.createSpace({
      name: 'Work Space',
      password: 'SecondaryDevicePassword!',
      masterKey: workMasterKey,
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const secWorkSess = vaultSecondary.unlockSpace('SecondaryDevicePassword!', secWorkHeader.spaceId);
    const secWorkDoc = idMgr.createIdentity(secWorkSess, storeSecondary);

    // Identity on secondary device matches primary device's Work Space identity
    expect(secWorkDoc.identityId).toBe(idWork.identityId);

    // 8. Secondary device has zero knowledge of Main or Private spaces
    expect(vaultSecondary.listEnvelopes().length).toBe(1);
    expect(vaultSecondary.getEnvelope(sessMain.spaceId)).toBeUndefined();
    expect(vaultSecondary.getEnvelope(sessPrivate.spaceId)).toBeUndefined();
  });
});

