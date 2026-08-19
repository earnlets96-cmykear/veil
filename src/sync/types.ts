/**
 * VEIL Sync Engine Types & State Enums.
 */

export type SyncStatus = 'LOCAL' | 'PENDING_UPLOAD' | 'SYNCED' | 'REMOTE' | 'DELETED';

export interface SyncableRecord<T = any> {
  id: string;
  spaceId: string;
  version: number;
  syncStatus: SyncStatus;
  data: T;
  updatedAt: number;
  deletedAt?: number;
}

export interface SyncEngineStats {
  pushedCount: number;
  pulledCount: number;
  deletedCount: number;
  conflictsResolved: number;
  lastSyncAt: number;
}
