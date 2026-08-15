/**
 * Persistent Encrypted Envelope Queue for VEIL Spaces.
 *
 * Implements persistent outbound queueing (for offline / retry tolerance),
 * inbound processing queues, duplicate envelope reconciliation, and ACK safety.
 *
 * All queue records are persisted via EncryptedSpaceStore under the active Space's
 * derived StorageKey. Plaintexts NEVER touch disk.
 */

import { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { SpaceSession } from '../spaces/session.ts';
import { QueuedOutboundEnvelope, QueuedInboundEnvelope, DeliveryStatus } from './types.ts';

const KEY_OUTBOUND_QUEUE = 'net_outbound_queue';
const KEY_INBOUND_QUEUE = 'net_inbound_queue';
const KEY_PROCESSED_IDS = 'net_processed_envelope_ids';

export class EnvelopeQueue {
  private store: EncryptedSpaceStore;

  constructor(store: EncryptedSpaceStore) {
    this.store = store;
  }

  // ===========================================================================
  // OUTBOUND QUEUE
  // ===========================================================================

  public async enqueueOutbound(session: SpaceSession, envelope: QueuedOutboundEnvelope): Promise<void> {
    const queue = (await this.store.getAsync<QueuedOutboundEnvelope[]>(session, KEY_OUTBOUND_QUEUE)) || [];
    queue.push(envelope);
    await this.store.setAsync(session, KEY_OUTBOUND_QUEUE, queue);
  }

  public async listOutbound(session: SpaceSession): Promise<QueuedOutboundEnvelope[]> {
    return (await this.store.getAsync<QueuedOutboundEnvelope[]>(session, KEY_OUTBOUND_QUEUE)) || [];
  }

  public async removeOutbound(session: SpaceSession, queueId: string): Promise<void> {
    const queue = (await this.store.getAsync<QueuedOutboundEnvelope[]>(session, KEY_OUTBOUND_QUEUE)) || [];
    const filtered = queue.filter(item => item.queueId !== queueId);
    await this.store.setAsync(session, KEY_OUTBOUND_QUEUE, filtered);
  }

  public async updateOutboundStatus(
    session: SpaceSession,
    queueId: string,
    status: DeliveryStatus,
    error?: string
  ): Promise<void> {
    const queue = (await this.store.getAsync<QueuedOutboundEnvelope[]>(session, KEY_OUTBOUND_QUEUE)) || [];
    const item = queue.find(i => i.queueId === queueId);
    if (item) {
      item.status = status;
      item.lastAttemptAt = Date.now();
      if (error) item.errorMessage = error;
      if (status === 'SENDING') item.retryCount++;
      await this.store.setAsync(session, KEY_OUTBOUND_QUEUE, queue);
    }
  }

  // ===========================================================================
  // INBOUND QUEUE & DEDUPLICATION
  // ===========================================================================

  /**
   * Enqueues an inbound envelope if it has not already been processed.
   * Returns true if newly enqueued, false if it is a duplicate.
   */
  public async enqueueInbound(session: SpaceSession, envelope: QueuedInboundEnvelope): Promise<boolean> {
    // Check if duplicate
    const isDup = await this.isDuplicate(session, envelope.envelopeId);
    if (isDup) {
      return false;
    }

    const queue = (await this.store.getAsync<QueuedInboundEnvelope[]>(session, KEY_INBOUND_QUEUE)) || [];
    queue.push(envelope);
    await this.store.setAsync(session, KEY_INBOUND_QUEUE, queue);
    return true;
  }

  public async listPendingInbound(session: SpaceSession): Promise<QueuedInboundEnvelope[]> {
    const queue = (await this.store.getAsync<QueuedInboundEnvelope[]>(session, KEY_INBOUND_QUEUE)) || [];
    return queue.filter(item => item.status === 'QUEUED' || item.status === 'PROCESSING');
  }

  /**
   * Marks an inbound envelope as processed and records its envelopeId in the deduplication registry.
   */
  public async markInboundProcessed(session: SpaceSession, queueId: string): Promise<void> {
    const queue = (await this.store.getAsync<QueuedInboundEnvelope[]>(session, KEY_INBOUND_QUEUE)) || [];
    const item = queue.find(i => i.queueId === queueId);
    if (item) {
      item.status = 'PROCESSED';
      item.processedAt = Date.now();
      await this.store.setAsync(session, KEY_INBOUND_QUEUE, queue);

      // Record in deduplication list (capped at 5,000 recent IDs)
      const processedIds = (await this.store.getAsync<string[]>(session, KEY_PROCESSED_IDS)) || [];
      if (!processedIds.includes(item.envelopeId)) {
        processedIds.push(item.envelopeId);
        if (processedIds.length > 5000) {
          processedIds.shift();
        }
        await this.store.setAsync(session, KEY_PROCESSED_IDS, processedIds);
      }
    }
  }

  public async markInboundAcknowledged(session: SpaceSession, queueId: string): Promise<void> {
    const queue = (await this.store.getAsync<QueuedInboundEnvelope[]>(session, KEY_INBOUND_QUEUE)) || [];
    const item = queue.find(i => i.queueId === queueId);
    if (item) {
      item.status = 'DELIVERED_TO_RECIPIENT';
      item.acknowledgedAt = Date.now();
      // Remove acknowledged items from active inbound queue to free memory
      const remaining = queue.filter(i => i.queueId !== queueId);
      await this.store.setAsync(session, KEY_INBOUND_QUEUE, remaining);
    }
  }

  public async isDuplicate(session: SpaceSession, envelopeId: string): Promise<boolean> {
    const processedIds = (await this.store.getAsync<string[]>(session, KEY_PROCESSED_IDS)) || [];
    if (processedIds.includes(envelopeId)) return true;

    const queue = (await this.store.getAsync<QueuedInboundEnvelope[]>(session, KEY_INBOUND_QUEUE)) || [];
    return queue.some(i => i.envelopeId === envelopeId);
  }
}
