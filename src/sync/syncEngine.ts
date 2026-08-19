/**
 * Client-Side Bidirectional Synchronization Engine for VEIL.
 *
 * Reconciles local EncryptedSpaceStore cache with the VEIL Cloud Backend:
 * - Pushes local pending messages and attachments to the cloud.
 * - Pulls new remote messages from other authorized devices.
 * - Applies tombstones deterministically for multi-device deletion.
 * - Operates in offline mode and auto-syncs when online.
 *
 * HARD SECURITY INVARIANT:
 * All payloads synced across the wire are encrypted ciphertexts.
 * Zero plaintexts leave the local device.
 */

import type { CloudClient } from '../network/cloudClient.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { CloudMessageEntity, CloudSpaceEntity } from '../server/cloud/database/types.ts';
import type { SyncStatus, SyncEngineStats } from './types.ts';

const SYNC_MESSAGES_KEY_PREFIX = 'veil:sync:messages:';
const SYNC_CURSOR_KEY_PREFIX = 'veil:sync:cursor:';

export class SyncEngine {
  private store: EncryptedSpaceStore;
  private client: CloudClient;
  private isSyncing = false;
  private stats: SyncEngineStats = {
    pushedCount: 0,
    pulledCount: 0,
    deletedCount: 0,
    conflictsResolved: 0,
    lastSyncAt: 0,
  };

  constructor(store: EncryptedSpaceStore, client: CloudClient) {
    this.store = store;
    this.client = client;
  }

  public getStats(): SyncEngineStats {
    return { ...this.stats };
  }

  /**
   * Enqueues an encrypted message locally for synchronization.
   */
  public enqueueMessage(session: SpaceSession, message: CloudMessageEntity): void {
    const key = `${SYNC_MESSAGES_KEY_PREFIX}${session.spaceId}:${message.messageId}`;
    this.store.set(session, key, {
      ...message,
      syncStatus: 'PENDING_UPLOAD' as SyncStatus,
      updatedAt: Date.now(),
    });
  }

  /**
   * Marks a message as deleted locally and queues tombstone deletion for cloud sync.
   */
  public markMessageDeleted(session: SpaceSession, messageId: string): void {
    const key = `${SYNC_MESSAGES_KEY_PREFIX}${session.spaceId}:${messageId}`;
    const existing = this.store.get<CloudMessageEntity & { syncStatus: SyncStatus }>(session, key);
    if (existing) {
      existing.deletedAt = Date.now();
      existing.version = (existing.version || 1) + 1;
      existing.syncStatus = 'PENDING_UPLOAD';
      this.store.set(session, key, existing);
    }
  }

  /**
   * Executes a full synchronization cycle for the active Space:
   * 1. Push pending local messages to cloud.
   * 2. Pull remote messages from cloud since last cursor.
   * 3. Reconcile and save into local cache.
   */
  public async sync(session: SpaceSession): Promise<{ pushed: number; pulled: number }> {
    if (this.isSyncing) {
      return { pushed: 0, pulled: 0 };
    }
    this.isSyncing = true;

    try {
      if (!this.client.getSessionToken()) {
        return { pushed: 0, pulled: 0 }; // Not logged into cloud account
      }

      let pushed = 0;
      let pulled = 0;

      // 1. Collect pending local messages
      const pendingMessages: CloudMessageEntity[] = [];
      const allKeys = this.store.listKeys(session);
      const prefix = `${SYNC_MESSAGES_KEY_PREFIX}${session.spaceId}:`;

      for (const key of allKeys) {
        if (key.startsWith(prefix)) {
          const item = this.store.get<CloudMessageEntity & { syncStatus: SyncStatus }>(session, key);
          if (item && item.syncStatus === 'PENDING_UPLOAD') {
            pendingMessages.push(item);
          }
        }
      }

      // Push pending to cloud
      if (pendingMessages.length > 0) {
        const pushRes = await this.client.pushMessages(pendingMessages);
        for (const msg of pendingMessages) {
          if (pushRes.acceptedIds.includes(msg.messageId)) {
            const key = `${SYNC_MESSAGES_KEY_PREFIX}${session.spaceId}:${msg.messageId}`;
            this.store.set(session, key, {
              ...msg,
              syncStatus: 'SYNCED' as SyncStatus,
            });
            pushed++;
          }
        }
      }

      // 2. Pull remote messages since last cursor
      const cursorKey = `${SYNC_CURSOR_KEY_PREFIX}${session.spaceId}`;
      const lastCursor = this.store.get<number>(session, cursorKey) || 0;

      const remoteMessages = await this.client.pullMessages(session.spaceId, lastCursor, 200);
      let maxVersion = lastCursor;

      for (const remote of remoteMessages) {
        const key = `${SYNC_MESSAGES_KEY_PREFIX}${session.spaceId}:${remote.messageId}`;
        const local = this.store.get<CloudMessageEntity & { syncStatus: SyncStatus }>(session, key);

        if (!local || remote.version >= local.version) {
          this.store.set(session, key, {
            ...remote,
            syncStatus: remote.deletedAt ? 'DELETED' : ('SYNCED' as SyncStatus),
          });
          pulled++;
        }

        if (remote.version > maxVersion) {
          maxVersion = remote.version;
        }
      }

      // Update cursor
      if (maxVersion > lastCursor) {
        this.store.set(session, cursorKey, maxVersion);
      }

      this.stats.pushedCount += pushed;
      this.stats.pulledCount += pulled;
      this.stats.lastSyncAt = Date.now();

      return { pushed, pulled };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Retrieves all synced messages for a conversation from the local cache.
   */
  public getMessagesForConversation(
    session: SpaceSession,
    conversationId: string
  ): CloudMessageEntity[] {
    const allKeys = this.store.listKeys(session);
    const prefix = `${SYNC_MESSAGES_KEY_PREFIX}${session.spaceId}:`;
    const results: CloudMessageEntity[] = [];

    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const item = this.store.get<CloudMessageEntity & { syncStatus: SyncStatus }>(session, key);
        if (item && item.conversationId === conversationId && !item.deletedAt) {
          results.push(item);
        }
      }
    }

    results.sort((a, b) => a.version - b.version);
    return results;
  }
}
