import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { DeviceEnrollmentManager } from '../src/device/enrollment.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { ed25519 } from '@noble/curves/ed25519.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 6: Multi-Device Enrollment & SAS Key Agreement Tests', () => {
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

  it('should enroll a secondary device via QR handshake and mutual SAS confirmation', () => {
    // 1. Primary device creates Space and Identity
    vaultPrimary.createSpace({ name: 'Work Space', password: 'PrimaryPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const primarySess = vaultPrimary.unlockSpace('PrimaryPassword123!');
    const primaryDoc = idMgr.createIdentity(primarySess, storePrimary);
    const primaryPriv = idMgr.loadIdentity(primarySess, storePrimary)!;

    // 2. Primary initiates enrollment session for "Work Space"
    const { ticket, state: primaryEnrollState } = DeviceEnrollmentManager.createEnrollmentSession(
      'device_laptop_01',
      [{ session: primarySess, name: 'Work Space' }]
    );
    expect(ticket.sessionId).toMatch(/^enroll_/);
    expect(ticket.selectedSpaceCount).toBe(1);

    // 3. Secondary device scans ticket, generates ephemeral and long-term device keys
    const secEphemeralPriv = x25519.utils.randomPrivateKey();
    const secEphemeralPub = x25519.getPublicKey(secEphemeralPriv);

    const secDeviceSigningPriv = ed25519.utils.randomPrivateKey();
    const secDeviceSigningPub = ed25519.getPublicKey(secDeviceSigningPriv);
    const secDeviceKAPriv = x25519.utils.randomPrivateKey();
    const secDeviceKAPub = x25519.getPublicKey(secDeviceKAPriv);

    const secondaryDeviceRecord = {
      deviceId: 'device_tablet_02',
      deviceName: 'Alice iPad Pro',
      deviceSigningPub: bytesToBase64(secDeviceSigningPub),
      deviceKeyAgreementPub: bytesToBase64(secDeviceKAPub),
    };

    // 4. Primary completes enrollment and encrypts tunnel
    const primaryRes = DeviceEnrollmentManager.completePrimaryEnrollment(
      primaryEnrollState,
      secEphemeralPub,
      secondaryDeviceRecord,
      primaryPriv.signingPrivateKey
    );

    // 5. Secondary completes enrollment and decrypts tunnel
    const secondaryRes = DeviceEnrollmentManager.receiveSecondaryEnrollment(
      secEphemeralPriv,
      primaryEnrollState.ephemeralPublicKey,
      primaryRes.encryptedTunnelPayload,
      primaryRes.nonce
    );

    // 6. Mutual SAS verification
    expect(primaryRes.sasCode).toBe(secondaryRes.sasCode);
    expect(primaryRes.sasCode.length).toBe(6);

    // 7. Verify secondary received the exact Space Master Key for "Work Space"
    expect(secondaryRes.payload.spaces.length).toBe(1);
    expect(secondaryRes.payload.spaces[0].name).toBe('Work Space');
    expect(secondaryRes.payload.spaces[0].spaceId).toBe(primarySess.spaceId);

    // Secondary unlocks new Space with local password using recovered Master Key
    const recoveredMasterKey = bytesToBase64(primarySess.getMasterKey());
    expect(secondaryRes.payload.spaces[0].masterKeyBase64).toBe(recoveredMasterKey);
  });
});
