/**
 * Encrypted Local Outbox for VEIL Spaces.
 *
 * Persists queued outgoing envelopes in the active Space's EncryptedSpaceStore
 * partition under the Space's StorageKey. Guarantees that pending messages
 * survive network interruptions and application restarts.
 */

import { OutboxItem, TransportEnvelope } from './types.ts';
import { generateEnvelopeId } from './envelope.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';

const OUTBOX_STORAGE_KEY = 'veil:transport:outbox';

export class EncryptedOutbox {
  private store: EncryptedSpaceStore;

  constructor(store: EncryptedSpaceStore) {
    this.store = store;
  }

  /**
   * Enqueues a transport envelope into the Space's encrypted outbox.
   */
  public enqueue(
    session: SpaceSession,
    envelope: TransportEnvelope,
    recipientMailboxId: string
  ): OutboxItem {
    this.assertSession(session);

    const items = this.loadItems(session);
    const item: OutboxItem = {
      id: generateEnvelopeId(),
      envelope,
      recipientMailboxId,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };

    items.push(item);
    this.saveItems(session, items);
    return item;
  }

  /**
   * Returns all pending or failed items ready for transmission.
   */
  public listPending(session: SpaceSession): OutboxItem[] {
    this.assertSession(session);
    const items = this.loadItems(session);
    return items.filter(i => i.status === 'pending' || i.status === 'failed');
  }

  /**
   * Returns all items in the outbox regardless of status.
   */
  public listAll(session: SpaceSession): OutboxItem[] {
    this.assertSession(session);
    return this.loadItems(session);
  }

  /**
   * Updates an item's status to 'sending' and increments its attempt counter.
   */
  public markSending(session: SpaceSession, id: string): void {
    this.assertSession(session);
    const items = this.loadItems(session);
    const item = items.find(i => i.id === id);
    if (item) {
      item.status = 'sending';
      item.attempts += 1;
      item.lastAttemptAt = Date.now();
      this.saveItems(session, items);
    }
  }

  /**
   * Removes an acknowledged item from the outbox (transmission succeeded).
   */
  public markAcknowledged(session: SpaceSession, id: string): void {
    this.assertSession(session);
    let items = this.loadItems(session);
    items = items.filter(i => i.id !== id);
    this.saveItems(session, items);
  }

  /**
   * Marks an item as failed with an error description (eligible for retry).
   */
  public markFailed(session: SpaceSession, id: string, error: string): void {
    this.assertSession(session);
    const items = this.loadItems(session);
    const item = items.find(i => i.id === id);
    if (item) {
      item.status = 'failed';
      item.error = error;
      item.lastAttemptAt = Date.now();
      this.saveItems(session, items);
    }
  }

  /**
   * Retrieves a single outbox item by ID.
   */
  public getItem(session: SpaceSession, id: string): OutboxItem | null {
    this.assertSession(session);
    const items = this.loadItems(session);
    return items.find(i => i.id === id) ?? null;
  }

  /**
   * Clears the outbox partition.
   */
  public clear(session: SpaceSession): void {
    this.assertSession(session);
    this.saveItems(session, []);
  }

  private loadItems(session: SpaceSession): OutboxItem[] {
    const raw = this.store.get<OutboxItem[]>(session, OUTBOX_STORAGE_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  private saveItems(session: SpaceSession, items: OutboxItem[]): void {
    this.store.set(session, OUTBOX_STORAGE_KEY, items);
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('Outbox access rejected: Space session is locked or destroyed');
    }
  }
}
