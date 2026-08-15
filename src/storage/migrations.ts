/**
 * Storage Schema & Migration Framework for VEIL.
 *
 * Manages versioned database schema upgrades within IDBTransaction boundaries.
 */

import { MigrationDefinition, StorageMigrationError } from './types.ts';

export const CURRENT_SCHEMA_VERSION = 1;
export const DB_NAME = 'veil_encrypted_vault';

export const STORE_ENVELOPES = 'envelopes';
export const STORE_RECORDS = 'records';
export const STORE_META = 'meta';

export const INDEX_BY_SPACE = 'by_spaceId';

/**
 * Baseline Version 1 Schema Migration:
 * Creates object stores for SpaceHeaderEnvelopes, Encrypted Records, and Storage Metadata.
 */
export const MIGRATION_V1: MigrationDefinition = {
  version: 1,
  description: 'Initial encrypted vault schema with envelopes, records, and meta stores',
  up: (db: IDBDatabase) => {
    // 1. Envelopes Store (stores SpaceHeaderEnvelope with spaceId as primary key)
    if (!db.objectStoreNames.contains(STORE_ENVELOPES)) {
      db.createObjectStore(STORE_ENVELOPES, { keyPath: 'spaceId' });
    }

    // 2. Records Store (stores encrypted records compound key [spaceId, key])
    if (!db.objectStoreNames.contains(STORE_RECORDS)) {
      const recordsStore = db.createObjectStore(STORE_RECORDS, { keyPath: ['spaceId', 'key'] });
      recordsStore.createIndex(INDEX_BY_SPACE, 'spaceId', { unique: false });
    }

    // 3. Metadata Store (stores schema metadata and initialization timestamp)
    if (!db.objectStoreNames.contains(STORE_META)) {
      db.createObjectStore(STORE_META, { keyPath: 'key' });
    }
  },
};

/** Registry of all ordered schema migrations */
export const SCHEMA_MIGRATIONS: MigrationDefinition[] = [
  MIGRATION_V1,
];

/**
 * Runs all applicable schema migrations during IDBOpenDBRequest.onupgradeneeded.
 *
 * @param db The IDBDatabase instance being upgraded
 * @param tx The IDBTransaction of the upgrade
 * @param oldVersion The prior database version (0 for newly created)
 * @param newVersion The target database version
 */
export function runMigrations(
  db: IDBDatabase,
  tx: IDBTransaction,
  oldVersion: number,
  newVersion: number
): void {
  try {
    for (const migration of SCHEMA_MIGRATIONS) {
      if (migration.version > oldVersion && migration.version <= newVersion) {
        migration.up(db, tx);
      }
    }
  } catch (err: any) {
    throw new StorageMigrationError(`Migration from v${oldVersion} to v${newVersion} failed: ${err.message}`);
  }
}
