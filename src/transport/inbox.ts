/**
 * Encrypted Local Inbox & Idempotent Deduplication for VEIL Spaces.
 *
 * Persists received transport envelopes in the Space's EncryptedSpaceStore
 * and maintains a cryptographic deduplication registry of processed envelope IDs
 * to prevent replay attacks and duplicate delivery from network retries.
 */

import { InboxItem, TransportEnvelope } from './types.ts';
import { validateTransportEnvelope } from './envelope.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';

const INBOX_STORAGE_KEY = 'veil:transport:inbox';
const PROCESSED_IDS_KEY = 'veil:transport:processed_ids';

export interface ReceiveResult {
  accepted: boolean;
  duplicate: boolean;
  item?: InboxItem;
  error?: string;
}

export class EncryptedInbox {
  private store: EncryptedSpaceStore;

  constructor(store: EncryptedSpaceStore) {
    this.store = store;
  }

  /**
   * Receives, deduplicates, and stores an incoming transport envelope.
   *
   * @param session Active SpaceSession
   * @param envelope Incoming TransportEnvelope
   * @returns ReceiveResult with accepted/duplicate status
   */
  public receiveEnvelope(session: SpaceSession, envelope: TransportEnvelope): ReceiveResult {
    this.assertSession(session);

    // 1. Validate envelope integrity and expiration
    if (!validateTransportEnvelope(envelope)) {
      return { accepted: false, duplicate: false, error: 'Invalid or expired transport envelope' };
    }

    // 2. Check for duplicate envelopeId (Replay / Retry Protection)
    const processedIds = this.loadProcessedIds(session);
    if (processedIds.includes(envelope.envelopeId)) {
      return { accepted: false, duplicate: true, error: `Duplicate envelope rejected: ${envelope.envelopeId}` };
    }

    // 3. Store new InboxItem
    const item: InboxItem = {
      envelopeId: envelope.envelopeId,
      mailboxId: envelope.mailboxId,
      payload: envelope.payload,
      sizeClass: envelope.sizeClass,
      receivedAt: Date.now(),
      createdAt: envelope.createdAt,
      expiresAt: envelope.expiresAt,
    };

    const inboxItems = this.loadInboxItems(session);
    inboxItems.push(item);
    this.saveInboxItems(session, inboxItems);

    // 4. Mark envelopeId as processed
    processedIds.push(envelope.envelopeId);
    this.saveProcessedIds(session, processedIds);

    return { accepted: true, duplicate: false, item };
  }

  /**
   * Returns all envelopes currently stored in the Space's inbox.
   */
  public listEnvelopes(session: SpaceSession): InboxItem[] {
    this.assertSession(session);
    return this.loadInboxItems(session);
  }

  /**
   * Checks whether a specific envelopeId has already been processed.
   */
  public hasProcessed(session: SpaceSession, envelopeId: string): boolean {
    this.assertSession(session);
    const processedIds = this.loadProcessedIds(session);
    return processedIds.includes(envelopeId);
  }

  /**
   * Clears the inbox and processed ID registry.
   */
  public clear(session: SpaceSession): void {
    this.assertSession(session);
    this.saveInboxItems(session, []);
    this.saveProcessedIds(session, []);
  }

  private loadInboxItems(session: SpaceSession): InboxItem[] {
    const raw = this.store.get<InboxItem[]>(session, INBOX_STORAGE_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  private saveInboxItems(session: SpaceSession, items: InboxItem[]): void {
    this.store.set(session, INBOX_STORAGE_KEY, items);
  }

  private loadProcessedIds(session: SpaceSession): string[] {
    const raw = this.store.get<string[]>(session, PROCESSED_IDS_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  private saveProcessedIds(session: SpaceSession, ids: string[]): void {
    this.store.set(session, PROCESSED_IDS_KEY, ids);
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('Inbox access rejected: Space session is locked or destroyed');
    }
  }
}
