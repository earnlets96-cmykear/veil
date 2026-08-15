/**
 * Client Transport Manager for VEIL.
 *
 * Coordinates local encrypted outboxes, inboxes, and network adapters.
 * Implements exponential backoff, retry queues, offline tolerance, and automatic deduplication.
 */

import {
  ITransportAdapter,
  TransportEnvelope,
  MailboxCapability,
  InboxItem,
  OutboxItem,
} from './types.ts';
import { EncryptedOutbox } from './outbox.ts';
import { EncryptedInbox } from './inbox.ts';
import { deriveCapabilityVerifier } from './capability.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';

export interface TransportClientOptions {
  adapter: ITransportAdapter;
  store: EncryptedSpaceStore;
  maxRetries?: number;
}

export class TransportClient {
  private adapter: ITransportAdapter;
  private outbox: EncryptedOutbox;
  private inbox: EncryptedInbox;
  private maxRetries: number;

  constructor(options: TransportClientOptions) {
    this.adapter = options.adapter;
    this.outbox = new EncryptedOutbox(options.store);
    this.inbox = new EncryptedInbox(options.store);
    this.maxRetries = options.maxRetries ?? 5;
  }

  /**
   * Registers a blind mailbox on the transport server for the active Space.
   */
  public async registerMailbox(
    session: SpaceSession,
    capability: MailboxCapability
  ): Promise<boolean> {
    this.assertSession(session);
    const verifier = deriveCapabilityVerifier(capability.capability);
    return this.adapter.createMailbox(capability.mailboxId, verifier);
  }

  /**
   * Enqueues an outgoing envelope in the Space's outbox and attempts immediate delivery.
   */
  public async sendEnvelope(
    session: SpaceSession,
    envelope: TransportEnvelope,
    recipientMailboxId: string
  ): Promise<OutboxItem> {
    this.assertSession(session);

    // 1. Enqueue in local encrypted outbox
    const item = this.outbox.enqueue(session, envelope, recipientMailboxId);

    // 2. Attempt immediate flush
    await this.processOutbox(session);

    return this.outbox.getItem(session, item.id) ?? item;
  }

  /**
   * Flushes all pending outbox messages to the transport server.
   * Tolerates network failures without losing local queued state.
   */
  public async processOutbox(session: SpaceSession): Promise<{ sent: number; failed: number }> {
    this.assertSession(session);

    const pending = this.outbox.listPending(session);
    let sent = 0;
    let failed = 0;

    for (const item of pending) {
      if (item.attempts >= this.maxRetries) {
        failed++;
        continue;
      }

      this.outbox.markSending(session, item.id);

      try {
        const success = await this.adapter.postEnvelope(item.envelope);
        if (success) {
          this.outbox.markAcknowledged(session, item.id);
          sent++;
        } else {
          this.outbox.markFailed(session, item.id, 'Server rejected envelope');
          failed++;
        }
      } catch (err: any) {
        this.outbox.markFailed(session, item.id, err.message || 'Network transport failure');
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Fetches incoming envelopes from the server, deduplicates them into the Space's inbox,
   * and acknowledges them on the server.
   */
  public async fetchAndReceive(
    session: SpaceSession,
    mailboxId: string,
    capabilitySecret: string
  ): Promise<InboxItem[]> {
    this.assertSession(session);

    // 1. Fetch envelopes from server
    const envelopes = await this.adapter.fetchEnvelopes(mailboxId, capabilitySecret);
    const newItems: InboxItem[] = [];

    // 2. Process each envelope through the inbox deduplication pipeline
    for (const env of envelopes) {
      const res = this.inbox.receiveEnvelope(session, env);
      if (res.accepted && res.item) {
        newItems.push(res.item);
      }

      // Acknowledge envelope on server if accepted or duplicate
      if (res.accepted || res.duplicate) {
        await this.adapter.acknowledgeEnvelope(mailboxId, capabilitySecret, env.envelopeId);
      }
    }

    return newItems;
  }

  /**
   * Returns all items in the Space's local inbox.
   */
  public getInboxItems(session: SpaceSession): InboxItem[] {
    this.assertSession(session);
    return this.inbox.listEnvelopes(session);
  }

  /**
   * Returns all items in the Space's local outbox.
   */
  public getOutboxItems(session: SpaceSession): OutboxItem[] {
    this.assertSession(session);
    return this.outbox.listAll(session);
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('TransportClient rejected: Space session is locked or destroyed');
    }
  }
}
