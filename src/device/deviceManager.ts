/**
 * Multi-Device Management & Revocation for VEIL Spaces.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha256.js';
import {
  DeviceRecord,
  DeviceRegistry,
  DeviceRevocationRecord,
} from './types.ts';
import { SpaceIdentityManager } from '../identity/manager.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { bytesToBase64 } from '../crypto/utils.ts';

const DEVICE_REGISTRY_PREFIX = 'veil:device:registry:';

export class DeviceManager {
  private store: EncryptedSpaceStore;
  private idMgr: SpaceIdentityManager;

  constructor(store: EncryptedSpaceStore, idMgr: SpaceIdentityManager) {
    this.store = store;
    this.idMgr = idMgr;
  }

  /**
   * Initializes or gets the DeviceRegistry for the active Space.
   */
  public getOrCreateRegistry(session: SpaceSession, primaryDeviceId = 'primary_device'): DeviceRegistry {
    this.assertSession(session);
    const key = `${DEVICE_REGISTRY_PREFIX}${session.spaceId}`;
    let registry = this.store.get<DeviceRegistry>(session, key);

    if (!registry) {
      const identity = this.idMgr.loadIdentity(session, this.store);
      const identityDoc = this.idMgr.getPublicDocument(session, this.store);

      const primaryRecord: DeviceRecord = {
        deviceId: primaryDeviceId,
        deviceName: 'Primary Device',
        deviceSigningPub: identityDoc?.signingPublicKey || '',
        deviceKeyAgreementPub: identityDoc?.keyAgreementPublicKey || '',
        enrolledAt: Date.now(),
        enrolledByDeviceId: primaryDeviceId,
        status: 'ACTIVE',
        authorizationSignature: identityDoc?.signature || '',
      };

      registry = {
        spaceId: session.spaceId,
        devices: {
          [primaryDeviceId]: primaryRecord,
        },
        revocations: [],
        updatedAt: Date.now(),
      };
      this.store.set(session, key, registry);
    }

    return registry;
  }

  /**
   * Registers a newly enrolled device into the Space's registry.
   */
  public registerDevice(session: SpaceSession, device: DeviceRecord): void {
    this.assertSession(session);
    const registry = this.getOrCreateRegistry(session);

    if (registry.devices[device.deviceId] && registry.devices[device.deviceId].status === 'REVOKED') {
      throw new Error(`Cannot register device ${device.deviceId}: device has been revoked`);
    }

    registry.devices[device.deviceId] = device;
    registry.updatedAt = Date.now();
    this.saveRegistry(session, registry);
  }

  /**
   * Revokes a secondary device, generating an Ed25519-signed revocation tombstone.
   */
  public revokeDevice(
    session: SpaceSession,
    targetDeviceId: string,
    revokingDeviceId = 'primary_device'
  ): DeviceRevocationRecord {
    this.assertSession(session);
    const registry = this.getOrCreateRegistry(session);

    const target = registry.devices[targetDeviceId];
    if (!target) {
      throw new Error(`Device ${targetDeviceId} not found in registry`);
    }
    if (target.status === 'REVOKED') {
      throw new Error(`Device ${targetDeviceId} is already revoked`);
    }

    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) throw new Error('Space has no identity');

    const revokedAt = Date.now();
    const toSign = new TextEncoder().encode(
      JSON.stringify({
        spaceId: session.spaceId,
        targetDeviceId,
        revokedBy: revokingDeviceId,
        revokedAt,
      })
    );
    const sig = ed25519.sign(sha256(toSign), identity.signingPrivateKey);

    const revocationRecord: DeviceRevocationRecord = {
      revocationId: `rev_${Date.now()}_${targetDeviceId.slice(0, 6)}`,
      spaceId: session.spaceId,
      targetDeviceId,
      revokedAt,
      revokedByDeviceId: revokingDeviceId,
      signature: bytesToBase64(sig),
    };

    target.status = 'REVOKED';
    registry.revocations.push(revocationRecord);
    registry.updatedAt = Date.now();

    this.saveRegistry(session, registry);

    return revocationRecord;
  }

  /**
   * Checks if a device ID is currently authorized for the Space.
   */
  public isDeviceAuthorized(session: SpaceSession, deviceId: string): boolean {
    this.assertSession(session);
    const registry = this.getOrCreateRegistry(session);
    const dev = registry.devices[deviceId];
    return dev !== undefined && dev.status === 'ACTIVE';
  }

  /**
   * Returns all active enrolled devices.
   */
  public getActiveDevices(session: SpaceSession): DeviceRecord[] {
    this.assertSession(session);
    const registry = this.getOrCreateRegistry(session);
    return Object.values(registry.devices).filter(d => d.status === 'ACTIVE');
  }

  private saveRegistry(session: SpaceSession, registry: DeviceRegistry): void {
    const key = `${DEVICE_REGISTRY_PREFIX}${session.spaceId}`;
    this.store.set(session, key, registry);
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('DeviceManager rejected: Space session is locked or destroyed');
    }
  }
}
