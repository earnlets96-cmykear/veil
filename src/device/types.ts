/**
 * Multi-Device Enrollment & Management Types for VEIL.
 */

export type DeviceStatus = 'ACTIVE' | 'REVOKED';

export interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  deviceSigningPub: string;        // Base64 Ed25519 public key
  deviceKeyAgreementPub: string;   // Base64 X25519 public key
  enrolledAt: number;
  enrolledByDeviceId: string;
  status: DeviceStatus;
  authorizationSignature: string;  // Base64 Ed25519 signature by Space Identity
}

export interface EnrollmentTicket {
  sessionId: string;
  primaryEphemeralPub: string;     // Base64 X25519 ephemeral pub
  token: string;                   // Random linking token
  expiresAt: number;
  selectedSpaceCount: number;
}

export interface SpaceSyncEnvelope {
  spaceId: string;
  name: string;
  masterKeyBase64: string;         // Base64 32-byte SMK
}

export interface EnrollmentPayload {
  sessionId: string;
  primaryDeviceId: string;
  spaces: SpaceSyncEnvelope[];
  deviceAuthorization: DeviceRecord;
}

export interface DeviceRevocationRecord {
  revocationId: string;
  spaceId: string;
  targetDeviceId: string;
  revokedAt: number;
  revokedByDeviceId: string;
  signature: string; // Base64 Ed25519 signature by Space Identity
}

export interface DeviceRegistry {
  spaceId: string;
  devices: Record<string, DeviceRecord>;
  revocations: DeviceRevocationRecord[];
  updatedAt: number;
}
