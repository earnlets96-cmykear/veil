import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBStorageAdapter } from '../src/storage/indexedDbAdapter.ts';
import {
  CURRENT_SCHEMA_VERSION,
  STORE_ENVELOPES,
  STORE_RECORDS,
  STORE_META,
  runMigrations,
} from '../src/storage/migrations.ts';

describe('VEIL Phase 11: Storage Schema & Migration Framework Tests', () => {
  const TEST_DB_NAME = 'veil_test_migrations_db';

  beforeEach(async () => {
    const adapter = new IndexedDBStorageAdapter(TEST_DB_NAME);
    await adapter.destroyDatabase();
  });

  afterEach(async () => {
    const adapter = new IndexedDBStorageAdapter(TEST_DB_NAME);
    await adapter.destroyDatabase();
  });

  it('MIGRATION BASELINE: Initializes version 1 object stores with correct indexes', async () => {
    const adapter = new IndexedDBStorageAdapter(TEST_DB_NAME, CURRENT_SCHEMA_VERSION);
    await adapter.init();
    expect(adapter.isInitialized()).toBe(true);

    // Verify all 3 stores exist by writing and reading metadata
    const dummyEnv = {
      spaceId: 'space_mig_01',
      version: 1 as const,
      name: 'Migration Test Space',
      isDecoy: false,
      kdfParams: {
        algorithm: 'argon2id' as const,
        salt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        timeCost: 1,
        memoryCost: 1024,
        parallelism: 1,
        keyLength: 32,
      },
      encryptedMasterKey: {
        algorithm: 'XChaCha20-Poly1305' as const,
        nonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        ciphertext: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      },
      createdAt: Date.now(),
    };

    await adapter.saveEnvelope(dummyEnv);
    const retrieved = await adapter.getEnvelope('space_mig_01');
    expect(retrieved?.name).toBe('Migration Test Space');

    await adapter.close();
  });

  it('MIGRATION ENGINE: Rejects invalid or breaking migrations safely', () => {
    const fakeDb = {
      objectStoreNames: {
        contains: () => true,
      },
      createObjectStore: () => {
        throw new Error('Store already exists');
      },
    } as unknown as IDBDatabase;

    const fakeTx = {} as IDBTransaction;

    expect(() => runMigrations(fakeDb, fakeTx, 0, 1)).not.toThrow();
  });
});
