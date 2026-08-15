/**
 * Production IndexedDB Storage Adapter for VEIL.
 *
 * Implements persistent, partitioned storage for SpaceHeaderEnvelopes and
 * authenticated encrypted application records using browser IndexedDB.
 *
 * SECURITY & GOVERNANCE:
 * - Fails CLOSED if IndexedDB is unavailable or initialization fails (never silently falls back to volatile memory).
 * - Enforces zero-plaintext storage: saves only encrypted envelopes and encrypted records.
 * - Manages schema versions and atomic migrations inside IDBTransaction boundaries.
 */

import {
  IStorageAdapter,
  StoredRecord,
  StorageUnavailableError,
  StorageQuotaError,
  StorageCorruptionError,
} from './types.ts';
import {
  DB_NAME,
  CURRENT_SCHEMA_VERSION,
  STORE_ENVELOPES,
  STORE_RECORDS,
  STORE_META,
  INDEX_BY_SPACE,
  runMigrations,
} from './migrations.ts';
import type { SpaceHeaderEnvelope } from '../types/index.ts';

export class IndexedDBStorageAdapter implements IStorageAdapter {
  private dbName: string;
  private dbVersion: number;
  private db: IDBDatabase | null = null;
  private idbFactory: IDBFactory | null = null;

  constructor(dbName = DB_NAME, dbVersion = CURRENT_SCHEMA_VERSION, customFactory?: IDBFactory | null) {
    this.dbName = dbName;
    this.dbVersion = dbVersion;
    this.idbFactory = customFactory !== undefined ? customFactory : (typeof indexedDB !== 'undefined' ? indexedDB : null);
  }


  /**
   * Initializes the IndexedDB database connection and executes pending schema migrations.
   * Fails closed with StorageUnavailableError if IndexedDB is not supported or blocked.
   */
  public async init(): Promise<void> {
    if (this.db) return; // Already initialized

    if (!this.idbFactory) {
      // In production, we FAIL CLOSED if IndexedDB is missing
      throw new StorageUnavailableError(
        'IndexedDB is not available in the current runtime environment. Storage failed closed.'
      );
    }

    return new Promise<void>((resolve, reject) => {
      let openRequest: IDBOpenDBRequest;

      try {
        openRequest = this.idbFactory!.open(this.dbName, this.dbVersion);
      } catch (err: any) {
        return reject(new StorageUnavailableError(`Failed to open IndexedDB "${this.dbName}": ${err.message}`));
      }

      openRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = openRequest.result;
        const tx = openRequest.transaction!;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion || this.dbVersion;

        runMigrations(db, tx, oldVersion, newVersion);
      };

      openRequest.onsuccess = () => {
        this.db = openRequest.result;
        
        // Handle unexpected connection drops or version changes
        this.db.onversionchange = () => {
          this.close();
        };

        resolve();
      };

      openRequest.onerror = () => {
        const error = openRequest.error;
        reject(
          new StorageUnavailableError(
            `IndexedDB open request failed: ${error ? error.message : 'unknown error'}`
          )
        );
      };

      openRequest.onblocked = () => {
        reject(
          new StorageUnavailableError(
            `IndexedDB database open was blocked by an active unclosed connection.`
          )
        );
      };
    });
  }

  public isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Persists an encrypted SpaceHeaderEnvelope.
   */
  public async saveEnvelope(envelope: SpaceHeaderEnvelope): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_ENVELOPES, 'readwrite');
        const store = tx.objectStore(STORE_ENVELOPES);
        const req = store.put(envelope);

        req.onsuccess = () => resolve();
        req.onerror = () => this.handleTxError(req.error, tx, reject);
        tx.onerror = () => this.handleTxError(tx.error, tx, reject);
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Retrieves a SpaceHeaderEnvelope by spaceId.
   */
  public async getEnvelope(spaceId: string): Promise<SpaceHeaderEnvelope | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_ENVELOPES, 'readonly');
        const store = tx.objectStore(STORE_ENVELOPES);
        const req = store.get(spaceId);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(this.wrapError(req.error));
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Lists all persisted SpaceHeaderEnvelopes.
   */
  public async listEnvelopes(): Promise<SpaceHeaderEnvelope[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_ENVELOPES, 'readonly');
        const store = tx.objectStore(STORE_ENVELOPES);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(this.wrapError(req.error));
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Deletes a SpaceHeaderEnvelope and cascades to clear its records partition.
   */
  public async deleteEnvelope(spaceId: string): Promise<boolean> {
    const db = this.getDb();
    const exists = await this.getEnvelope(spaceId);
    if (!exists) return false;

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_ENVELOPES, STORE_RECORDS], 'readwrite');
        const envStore = tx.objectStore(STORE_ENVELOPES);
        envStore.delete(spaceId);

        // Delete associated records
        const recStore = tx.objectStore(STORE_RECORDS);
        const index = recStore.index(INDEX_BY_SPACE);
        const range = IDBKeyRange.only(spaceId);
        const cursorReq = index.openKeyCursor(range);

        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            recStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => this.handleTxError(tx.error, tx, reject);
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });

    return true;
  }

  /**
   * Persists an encrypted application record.
   */
  public async saveRecord(spaceId: string, record: StoredRecord): Promise<void> {
    const db = this.getDb();
    const item = { ...record, spaceId };

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_RECORDS, 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.put(item);

        req.onsuccess = () => resolve();
        req.onerror = () => this.handleTxError(req.error, tx, reject);
        tx.onerror = () => this.handleTxError(tx.error, tx, reject);
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Retrieves an encrypted application record by spaceId and key.
   */
  public async getRecord(spaceId: string, key: string): Promise<StoredRecord | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_RECORDS, 'readonly');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.get([spaceId, key]);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(this.wrapError(req.error));
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Lists all encrypted records belonging to a given Space.
   */
  public async listRecords(spaceId: string): Promise<StoredRecord[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_RECORDS, 'readonly');
        const store = tx.objectStore(STORE_RECORDS);
        const index = store.index(INDEX_BY_SPACE);
        const range = IDBKeyRange.only(spaceId);
        const req = index.getAll(range);

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(this.wrapError(req.error));
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Deletes an encrypted application record.
   */
  public async deleteRecord(spaceId: string, key: string): Promise<boolean> {
    const db = this.getDb();
    const exists = await this.getRecord(spaceId, key);
    if (!exists) return false;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_RECORDS, 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.delete([spaceId, key]);

        req.onsuccess = () => resolve(true);
        req.onerror = () => this.handleTxError(req.error, tx, reject);
        tx.onerror = () => this.handleTxError(tx.error, tx, reject);
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Clears all records belonging to a specific Space.
   */
  public async clearPartition(spaceId: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_RECORDS, 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        const index = store.index(INDEX_BY_SPACE);
        const range = IDBKeyRange.only(spaceId);
        const cursorReq = index.openKeyCursor(range);

        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => this.handleTxError(tx.error, tx, reject);
      } catch (err: any) {
        reject(this.wrapError(err));
      }
    });
  }

  /**
   * Closes the active IndexedDB connection.
   */
  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Closes the connection and destroys the physical IndexedDB database from disk.
   */
  public async destroyDatabase(): Promise<void> {
    await this.close();
    if (!this.idbFactory) return;

    return new Promise((resolve, reject) => {
      const req = this.idbFactory!.deleteDatabase(this.dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Failed to delete IndexedDB "${this.dbName}"`));
      req.onblocked = () => resolve(); // Deleted once connections unblock
    });
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new StorageUnavailableError(
        'IndexedDBStorageAdapter is not initialized. Call init() before performing operations.'
      );
    }
    return this.db;
  }

  private handleTxError(error: DOMException | null, tx: IDBTransaction, reject: (err: any) => void): void {
    const wrapped = this.wrapError(error);
    try {
      tx.abort();
    } catch (_e) {
      // Ignore if transaction is already completed or aborted
    }
    reject(wrapped);
  }

  private wrapError(error: any): Error {
    if (!error) return new Error('Unknown IndexedDB error');
    if (error.name === 'QuotaExceededError') {
      return new StorageQuotaError(error.message);
    }
    if (error.name === 'InvalidStateError' || error.name === 'TransactionInactiveError') {
      return new StorageUnavailableError(error.message);
    }
    return new Error(`IndexedDB operation failed: ${error.message || error.name}`);
  }
}
