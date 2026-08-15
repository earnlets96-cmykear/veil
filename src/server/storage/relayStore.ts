/**
 * Relay Server Storage Interface for VEIL.
 *
 * Decouples relay business logic from specific database implementations.
 */

import { RelayEnvelope, MailboxRecord } from '../types.ts';

export interface IRelayStore {
  init(): Promise<void>;
  createMailbox(record: MailboxRecord): Promise<void>;
  getMailbox(mailboxId: string): Promise<MailboxRecord | null>;
  deleteMailbox(mailboxId: string): Promise<boolean>;
  saveEnvelope(envelope: RelayEnvelope): Promise<void>;
  getEnvelope(mailboxId: string, envelopeId: string): Promise<RelayEnvelope | null>;
  listEnvelopes(mailboxId: string, limit: number): Promise<RelayEnvelope[]>;
  deleteEnvelopes(mailboxId: string, envelopeIds: string[]): Promise<number>;
  countEnvelopes(mailboxId: string): Promise<number>;
  sweepExpired(now: number): Promise<{ expiredMailboxes: number; expiredEnvelopes: number }>;
  close(): Promise<void>;
  destroyStore(): Promise<void>;
}
