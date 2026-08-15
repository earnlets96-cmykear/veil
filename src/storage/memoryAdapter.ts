/**
 * In-Memory Storage Adapter for VEIL (TEST / NON-PRODUCTION ONLY).
 *
 * Provides an in-memory implementation of IStorageAdapter for unit tests
 * and explicitly configured non-persistent environments.
 */

import { IStorageAdapter, StoredRecord } from './types.ts';
import type { SpaceHeaderEnvelope } from '../types/index.ts';

export class MemoryStorageAdapter implements IStorageAdapter {
  private envelopes = new Map<string, SpaceHeaderEnvelope>();
  private records = new Map<string, Map<string, StoredRecord>>();
  private initialized = false;

  public async init(): Promise<void> {
    this.initialized = true;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async saveEnvelope(envelope: SpaceHeaderEnvelope): Promise<void> {
    this.assertInit();
    this.envelopes.set(envelope.spaceId, JSON.parse(JSON.stringify(envelope)));
  }

  public async getEnvelope(spaceId: string): Promise<SpaceHeaderEnvelope | null> {
    this.assertInit();
    const env = this.envelopes.get(spaceId);
    return env ? JSON.parse(JSON.stringify(env)) : null;
  }

  public async listEnvelopes(): Promise<SpaceHeaderEnvelope[]> {
    this.assertInit();
    return Array.from(this.envelopes.values()).map(env => JSON.parse(JSON.stringify(env)));
  }

  public async deleteEnvelope(spaceId: string): Promise<boolean> {
    this.assertInit();
    const existed = this.envelopes.delete(spaceId);
    this.records.delete(spaceId);
    return existed;
  }

  public async saveRecord(spaceId: string, record: StoredRecord): Promise<void> {
    this.assertInit();
    let partition = this.records.get(spaceId);
    if (!partition) {
      partition = new Map();
      this.records.set(spaceId, partition);
    }
    partition.set(record.key, { ...record });
  }

  public async getRecord(spaceId: string, key: string): Promise<StoredRecord | null> {
    this.assertInit();
    const partition = this.records.get(spaceId);
    if (!partition) return null;
    const rec = partition.get(key);
    return rec ? { ...rec } : null;
  }

  public async listRecords(spaceId: string): Promise<StoredRecord[]> {
    this.assertInit();
    const partition = this.records.get(spaceId);
    if (!partition) return [];
    return Array.from(partition.values()).map(r => ({ ...r }));
  }

  public async deleteRecord(spaceId: string, key: string): Promise<boolean> {
    this.assertInit();
    const partition = this.records.get(spaceId);
    if (!partition) return false;
    return partition.delete(key);
  }

  public async clearPartition(spaceId: string): Promise<void> {
    this.assertInit();
    this.records.delete(spaceId);
  }

  public async close(): Promise<void> {
    // Closes the connection but keeps memory state intact for testing connection close/open
    this.initialized = false;
  }

  public async destroyDatabase(): Promise<void> {
    this.envelopes.clear();
    this.records.clear();
    this.initialized = false;
  }

  private assertInit(): void {
    if (!this.initialized) {
      throw new Error('MemoryStorageAdapter is not initialized or has been closed.');
    }
  }
}
