/**
 * Persistent Storage Types & Interfaces for VEIL.
 *
 * Defines the contract for persistent encrypted local storage,
 * schema metadata, migrations, and error types.
 */

import type { SpaceHeaderEnvelope } from '../types/index.ts';

export interface StoredRecord {
  spaceId: string;
  key: string;
  nonce: string;       // Base64 24-byte nonce
  ciphertext: string;  // Base64 XChaCha20-Poly1305 ciphertext + tag
  updatedAt: number;
}

export interface DeletedMessageTombstone {
  messageId: string;
  conversationId: string;
  deletedAt: number;
}

export interface StorageMetadata {
  key: 'storage_metadata';
  schemaVersion: number;
  lastMigratedAt: number;
  initializedAt: number;
}

export interface MigrationDefinition {
  version: number;
  description: string;
  up: (db: IDBDatabase, tx: IDBTransaction) => Promise<void> | void;
}

export interface IStorageAdapter {
  init(): Promise<void>;
  isInitialized(): boolean;
  saveEnvelope(envelope: SpaceHeaderEnvelope): Promise<void>;
  getEnvelope(spaceId: string): Promise<SpaceHeaderEnvelope | null>;
  listEnvelopes(): Promise<SpaceHeaderEnvelope[]>;
  deleteEnvelope(spaceId: string): Promise<boolean>;
  saveRecord(spaceId: string, record: StoredRecord): Promise<void>;
  getRecord(spaceId: string, key: string): Promise<StoredRecord | null>;
  listRecords(spaceId: string): Promise<StoredRecord[]>;
  deleteRecord(spaceId: string, key: string): Promise<boolean>;
  clearPartition(spaceId: string): Promise<void>;
  close(): Promise<void>;
  destroyDatabase(): Promise<void>;
}

export class StorageUnavailableError extends Error {
  constructor(message = 'IndexedDB storage backend is unavailable or failed initialization. Operation failed closed.') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export class StorageQuotaError extends Error {
  constructor(message = 'Persistent storage quota exceeded.') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export class StorageCorruptionError extends Error {
  constructor(message = 'Persistent storage corruption or tampering detected.') {
    super(message);
    this.name = 'StorageCorruptionError';
  }
}

export class StorageMigrationError extends Error {
  constructor(message = 'Failed to execute storage schema migration.') {
    super(message);
    this.name = 'StorageMigrationError';
  }
}
