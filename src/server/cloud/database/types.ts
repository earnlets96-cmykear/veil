/**
 * VEIL Cloud Database Schemas & Interfaces.
 *
 * Defines the persistent server-side schema entities for Accounts, Devices,
 * Sessions, Spaces, Encrypted Messages, Encrypted Attachments, and Sync States.
 *
 * HARD SECURITY INVARIANT:
 * All message payloads, attachment contents, and space states stored in the
 * cloud database are client-encrypted ciphertexts (XChaCha20-Poly1305).
 * The server database contains ZERO plaintexts, ZERO private keys, and ZERO master keys.
 */

export interface AccountEntity {
  accountId: string;          // Opaque unique identifier (UUID/256-bit hex)
  username: string;           // Canonical unique username (e.g. "@alice")
  authHash: string;           // Base64 Argon2id authentication verifier
  authSalt: string;           // Base64 32-byte salt
  recoveryAnchor?: string;    // Opaque recovery anchor / challenge token
  createdAt: number;
  updatedAt: number;
}

export interface DeviceEntity {
  deviceId: string;           // Opaque unique device identifier
  accountId: string;          // Owning Account ID
  deviceName: string;         // Human-readable device label
  signingPublicKey: string;   // Base64 Ed25519 device public key
  keyAgreementPublicKey: string; // Base64 X25519 device public key
  status: 'ACTIVE' | 'REVOKED';
  createdAt: number;
  lastSeenAt: number;
}

export interface SessionEntity {
  sessionId: string;          // Opaque session ID
  accountId: string;          // Owning Account ID
  deviceId: string;           // Associated Device ID
  tokenHash: string;          // SHA-256 hash of the bearer session token
  createdAt: number;
  expiresAt: number;
  revokedAt?: number;
}

export interface CloudSpaceEntity {
  spaceId: string;            // Opaque Space ID
  accountId: string;          // Owning Account ID
  encryptedHeader: string;    // Base64 serialized encrypted SpaceHeaderEnvelope
  version: number;            // Monotonic version counter
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;         // Tombstone timestamp
}

export interface CloudMessageEntity {
  messageId: string;          // Opaque message ID
  accountId: string;          // Owning Account ID
  spaceId: string;            // Owning Space ID
  conversationId: string;     // Canonical conversation / peer ID
  senderDeviceId: string;     // Originating device ID
  encryptedPayload: string;   // Base64 XChaCha20-Poly1305 ciphertext
  nonce: string;              // Base64 24-byte nonce
  version: number;            // Monotonic sequence version
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;         // Tombstone for multi-device deletion sync
}

export interface CloudAttachmentEntity {
  attachmentId: string;       // Opaque attachment ID
  accountId: string;          // Owning Account ID
  spaceId: string;            // Owning Space ID
  objectId: string;           // Opaque Object Storage identifier
  encryptedMetadata: string;  // Base64 encrypted attachment metadata
  ciphertextSize: number;     // Total encrypted byte count
  ciphertextHash: string;     // SHA-256 hash of entire ciphertext for integrity
  encryptionVersion: number;
  status: 'UPLOADING' | 'COMMITTED' | 'DELETED';
  chunkCount: number;
  chunkSize: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface SyncStateEntity {
  accountId: string;
  deviceId: string;
  spaceId: string;
  lastSyncCursor: number;     // Highest message/state version synced
  updatedAt: number;
}

export interface RecoveryStateEntity {
  accountId: string;
  recoveryId: string;
  encryptedVaultBlob: string; // Base64 client-encrypted recovery vault payload
  kdfParams: string;          // JSON-serialized KdfParameters
  updatedAt: number;
}

export interface ICloudDatabase {
  init(): Promise<void>;
  close(): Promise<void>;

  // Account Operations
  createAccount(account: AccountEntity): Promise<void>;
  getAccountById(accountId: string): Promise<AccountEntity | null>;
  getAccountByUsername(username: string): Promise<AccountEntity | null>;
  updateAccount(account: AccountEntity): Promise<void>;

  // Device Operations
  registerDevice(device: DeviceEntity): Promise<void>;
  getDevice(accountId: string, deviceId: string): Promise<DeviceEntity | null>;
  listDevices(accountId: string): Promise<DeviceEntity[]>;
  updateDeviceStatus(accountId: string, deviceId: string, status: 'ACTIVE' | 'REVOKED', lastSeenAt?: number): Promise<void>;

  // Session Operations
  createSession(session: SessionEntity): Promise<void>;
  getSession(sessionId: string): Promise<SessionEntity | null>;
  getSessionByTokenHash(tokenHash: string): Promise<SessionEntity | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(accountId: string): Promise<void>;

  // Space Operations
  saveSpace(space: CloudSpaceEntity): Promise<void>;
  getSpace(accountId: string, spaceId: string): Promise<CloudSpaceEntity | null>;
  listSpaces(accountId: string): Promise<CloudSpaceEntity[]>;
  deleteSpace(accountId: string, spaceId: string): Promise<void>;

  // Message Operations
  saveMessage(message: CloudMessageEntity): Promise<void>;
  getMessage(accountId: string, spaceId: string, messageId: string): Promise<CloudMessageEntity | null>;
  listMessages(accountId: string, spaceId: string, options?: { conversationId?: string; sinceVersion?: number; limit?: number }): Promise<CloudMessageEntity[]>;
  deleteMessage(accountId: string, spaceId: string, messageId: string): Promise<void>;

  // Attachment Operations
  saveAttachment(attachment: CloudAttachmentEntity): Promise<void>;
  getAttachment(accountId: string, spaceId: string, attachmentId: string): Promise<CloudAttachmentEntity | null>;
  getAttachmentByObjectId(objectId: string): Promise<CloudAttachmentEntity | null>;
  listAttachments(accountId: string, spaceId: string): Promise<CloudAttachmentEntity[]>;
  deleteAttachment(accountId: string, spaceId: string, attachmentId: string): Promise<void>;

  // Recovery Operations
  saveRecoveryState(recovery: RecoveryStateEntity): Promise<void>;
  getRecoveryState(accountId: string): Promise<RecoveryStateEntity | null>;

  // Sync State Operations
  getSyncCursor(accountId: string, deviceId: string, spaceId: string): Promise<number>;
  updateSyncCursor(accountId: string, deviceId: string, spaceId: string, cursor: number): Promise<void>;
}
