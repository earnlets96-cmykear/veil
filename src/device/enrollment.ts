/**
 * Ephemeral Multi-Device Enrollment Protocol for VEIL.
 *
 * Implements ephemeral X25519 key agreement, 6-digit SAS verification,
 * and authenticated selective Space Master Key transfer.
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha256.js';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes, getRandomBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import {
  EnrollmentTicket,
  EnrollmentPayload,
  SpaceSyncEnvelope,
  DeviceRecord,
} from './types.ts';
import type { SpaceSession } from '../spaces/session.ts';

export const DOMAIN_DEVICE_SAS = new TextEncoder().encode('veil-v1-device-sas');
export const DOMAIN_DEVICE_TUNNEL = new TextEncoder().encode('veil-v1-device-tunnel');

export interface PrimaryEnrollmentState {
  sessionId: string;
  primaryDeviceId: string;
  ephemeralPrivateKey: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  selectedSpaces: { spaceId: string; name: string; masterKey: Uint8Array }[];
  expiresAt: number;
}

export class DeviceEnrollmentManager {
  /**
   * Primary device initiates an enrollment session with explicitly selected Spaces.
   */
  public static createEnrollmentSession(
    primaryDeviceId: string,
    selectedSpaceSessions: { session: SpaceSession; name: string }[],
    ttlMs = 300000 // 5 minutes
  ): { ticket: EnrollmentTicket; state: PrimaryEnrollmentState } {
    const ephemeralPriv = x25519.utils.randomPrivateKey();
    const ephemeralPub = x25519.getPublicKey(ephemeralPriv);

    const sessionId = `enroll_${bytesToBase64(getRandomBytes(12)).replace(/[+/=]/g, '')}`;
    const token = bytesToBase64(getRandomBytes(16));
    const expiresAt = Date.now() + ttlMs;

    const selectedSpaces = selectedSpaceSessions.map(({ session, name }) => ({
      spaceId: session.spaceId,
      name,
      masterKey: new Uint8Array(session.getMasterKey()),
    }));

    const ticket: EnrollmentTicket = {
      sessionId,
      primaryEphemeralPub: bytesToBase64(ephemeralPub),
      token,
      expiresAt,
      selectedSpaceCount: selectedSpaces.length,
    };

    const state: PrimaryEnrollmentState = {
      sessionId,
      primaryDeviceId,
      ephemeralPrivateKey: ephemeralPriv,
      ephemeralPublicKey: ephemeralPub,
      selectedSpaces,
      expiresAt,
    };

    return { ticket, state };
  }

  /**
   * Computes a 6-digit Short Authentication String (SAS) code from shared secret.
   */
  public static computeSAS(
    sharedSecret: Uint8Array,
    primaryEphemeralPub: Uint8Array,
    secondaryEphemeralPub: Uint8Array
  ): string {
    const salt = new Uint8Array(primaryEphemeralPub.length + secondaryEphemeralPub.length);
    salt.set(primaryEphemeralPub, 0);
    salt.set(secondaryEphemeralPub, primaryEphemeralPub.length);

    const sasBytes = hkdf(sha256, sharedSecret, salt, DOMAIN_DEVICE_SAS, 4);
    const view = new DataView(sasBytes.buffer, sasBytes.byteOffset, sasBytes.byteLength);
    const uint32 = view.getUint32(0, false);
    const codeNumber = uint32 % 1000000;
    return codeNumber.toString().padStart(6, '0');
  }

  /**
   * Primary device completes enrollment: encrypts selected Space Master Keys and authorizes secondary device.
   */
  public static completePrimaryEnrollment(
    state: PrimaryEnrollmentState,
    secondaryEphemeralPub: Uint8Array,
    secondaryDeviceRecord: Omit<DeviceRecord, 'authorizationSignature' | 'enrolledByDeviceId' | 'enrolledAt' | 'status'>,
    spaceSigningPriv: Uint8Array
  ): { sasCode: string; encryptedTunnelPayload: string; nonce: string } {
    if (Date.now() > state.expiresAt) {
      throw new Error('Enrollment session has expired');
    }

    // 1. Compute DH shared secret
    const sharedSecret = x25519.getSharedSecret(state.ephemeralPrivateKey, secondaryEphemeralPub);
    const sasCode = this.computeSAS(sharedSecret, state.ephemeralPublicKey, secondaryEphemeralPub);

    // 2. Sign secondary device authorization
    const enrolledAt = Date.now();
    const toSign = new TextEncoder().encode(
      JSON.stringify({
        deviceId: secondaryDeviceRecord.deviceId,
        signingPub: secondaryDeviceRecord.deviceSigningPub,
        kaPub: secondaryDeviceRecord.deviceKeyAgreementPub,
        enrolledBy: state.primaryDeviceId,
        enrolledAt,
      })
    );
    const authSig = ed25519.sign(sha256(toSign), spaceSigningPriv);

    const authorizedDevice: DeviceRecord = {
      ...secondaryDeviceRecord,
      enrolledAt,
      enrolledByDeviceId: state.primaryDeviceId,
      status: 'ACTIVE',
      authorizationSignature: bytesToBase64(authSig),
    };

    // 3. Package selected Space credentials
    const spacesSync: SpaceSyncEnvelope[] = state.selectedSpaces.map(s => ({
      spaceId: s.spaceId,
      name: s.name,
      masterKeyBase64: bytesToBase64(s.masterKey),
    }));

    const payload: EnrollmentPayload = {
      sessionId: state.sessionId,
      primaryDeviceId: state.primaryDeviceId,
      spaces: spacesSync,
      deviceAuthorization: authorizedDevice,
    };

    // 4. Encrypt payload over ephemeral tunnel
    const tunnelKey = hkdf(sha256, sharedSecret, new Uint8Array(0), DOMAIN_DEVICE_TUNNEL, 32);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(tunnelKey, JSON.stringify(payload));

    zeroize(sharedSecret);
    zeroize(tunnelKey);
    for (const sp of state.selectedSpaces) {
      zeroize(sp.masterKey);
    }
    zeroize(state.ephemeralPrivateKey);

    return {
      sasCode,
      encryptedTunnelPayload: bytesToBase64(ciphertext),
      nonce: bytesToBase64(nonce),
    };
  }

  /**
   * Secondary device completes enrollment by decrypting the tunnel payload.
   */
  public static receiveSecondaryEnrollment(
    secondaryEphemeralPriv: Uint8Array,
    primaryEphemeralPub: Uint8Array,
    encryptedTunnelPayload: string,
    nonce: string
  ): { sasCode: string; payload: EnrollmentPayload } {
    const secondaryEphemeralPub = x25519.getPublicKey(secondaryEphemeralPriv);

    // 1. Compute DH shared secret & SAS
    const sharedSecret = x25519.getSharedSecret(secondaryEphemeralPriv, primaryEphemeralPub);
    const sasCode = this.computeSAS(sharedSecret, primaryEphemeralPub, secondaryEphemeralPub);

    // 2. Decrypt tunnel payload
    const tunnelKey = hkdf(sha256, sharedSecret, new Uint8Array(0), DOMAIN_DEVICE_TUNNEL, 32);
    const nonceBytes = base64ToBytes(nonce);
    const cipherBytes = base64ToBytes(encryptedTunnelPayload);

    try {
      const plaintextBytes = decryptXChaCha20Poly1305(tunnelKey, nonceBytes, cipherBytes);
      const payload: EnrollmentPayload = JSON.parse(new TextDecoder().decode(plaintextBytes));
      return { sasCode, payload };
    } finally {
      zeroize(sharedSecret);
      zeroize(tunnelKey);
      zeroize(secondaryEphemeralPriv);
    }
  }
}
