/**
 * Relay Server Storage Interface for VEIL.
 *
 * Decouples relay business logic from specific database implementations.
 */

import type { RelayEnvelope, MailboxRecord, DirectorySearchResult } from '../types.ts';
import type { SignedProfileDocument } from '../../identity/profile.ts';

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

  // Directory & Public Profile Methods
  registerProfile(profile: SignedProfileDocument): Promise<void>;
  getProfileByUsername(canonicalUsername: string): Promise<SignedProfileDocument | null>;
  getProfileByIdentity(identityId: string): Promise<SignedProfileDocument | null>;
  searchProfiles(query: string, limit: number): Promise<DirectorySearchResult[]>;
  deleteProfile(identityId: string): Promise<boolean>;

  close(): Promise<void>;
  destroyStore(): Promise<void>;
}
