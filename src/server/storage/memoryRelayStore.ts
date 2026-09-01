/**
 * In-Memory Storage Implementation for VEIL Relay Server.
 *
 * Implements IRelayStore using in-memory Maps with bounded queues
 * and TTL garbage collection.
 */

import type { IRelayStore } from './relayStore.ts';
import type { RelayEnvelope, MailboxRecord, DirectorySearchResult } from '../types.ts';
import type { SignedProfileDocument } from '../../identity/profile.ts';

export class MemoryRelayStore implements IRelayStore {
  private mailboxes = new Map<string, MailboxRecord>();
  private envelopes = new Map<string, Map<string, RelayEnvelope>>();
  private profilesByUsername = new Map<string, SignedProfileDocument>();
  private profilesByIdentity = new Map<string, SignedProfileDocument>();
  private initialized = false;

  public async init(): Promise<void> {
    this.initialized = true;
  }

  public async createMailbox(record: MailboxRecord): Promise<void> {
    this.assertInit();
    this.mailboxes.set(record.mailboxId, { ...record });
    if (!this.envelopes.has(record.mailboxId)) {
      this.envelopes.set(record.mailboxId, new Map());
    }
  }

  public async getMailbox(mailboxId: string): Promise<MailboxRecord | null> {
    this.assertInit();
    const mb = this.mailboxes.get(mailboxId);
    if (!mb) return null;
    return { ...mb };
  }

  public async deleteMailbox(mailboxId: string): Promise<boolean> {
    this.assertInit();
    const existed = this.mailboxes.delete(mailboxId);
    this.envelopes.delete(mailboxId);
    return existed;
  }

  public async saveEnvelope(envelope: RelayEnvelope): Promise<void> {
    this.assertInit();
    let queue = this.envelopes.get(envelope.mailboxId);
    if (!queue) {
      queue = new Map();
      this.envelopes.set(envelope.mailboxId, queue);
    }
    queue.set(envelope.envelopeId, { ...envelope });
  }

  public async getEnvelope(mailboxId: string, envelopeId: string): Promise<RelayEnvelope | null> {
    this.assertInit();
    const queue = this.envelopes.get(mailboxId);
    if (!queue) return null;
    const env = queue.get(envelopeId);
    return env ? { ...env } : null;
  }

  public async listEnvelopes(mailboxId: string, limit: number): Promise<RelayEnvelope[]> {
    this.assertInit();
    const queue = this.envelopes.get(mailboxId);
    if (!queue) return [];
    const items = Array.from(queue.values()).slice(0, limit);
    return items.map(env => ({ ...env }));
  }

  public async deleteEnvelopes(mailboxId: string, envelopeIds: string[]): Promise<number> {
    this.assertInit();
    const queue = this.envelopes.get(mailboxId);
    if (!queue) return 0;

    let deleted = 0;
    for (const id of envelopeIds) {
      if (queue.delete(id)) {
        deleted++;
      }
    }
    return deleted;
  }

  public async countEnvelopes(mailboxId: string): Promise<number> {
    this.assertInit();
    const queue = this.envelopes.get(mailboxId);
    return queue ? queue.size : 0;
  }

  public async sweepExpired(now: number): Promise<{ expiredMailboxes: number; expiredEnvelopes: number }> {
    this.assertInit();
    let expiredMailboxes = 0;
    let expiredEnvelopes = 0;

    // 1. Sweep expired mailboxes
    for (const [id, mb] of this.mailboxes.entries()) {
      if (mb.expiresAt <= now) {
        this.mailboxes.delete(id);
        this.envelopes.delete(id);
        expiredMailboxes++;
      }
    }

    // 2. Sweep expired envelopes in surviving mailboxes
    for (const queue of this.envelopes.values()) {
      for (const [envId, env] of queue.entries()) {
        if (env.expiresAt <= now) {
          queue.delete(envId);
          expiredEnvelopes++;
        }
      }
    }

    // 3. Sweep expired profiles
    for (const [username, prof] of this.profilesByUsername.entries()) {
      if (prof.expiresAt && prof.expiresAt <= now) {
        this.profilesByUsername.delete(username);
        this.profilesByIdentity.delete(prof.identityId);
      }
    }

    return { expiredMailboxes, expiredEnvelopes };
  }

  // ===========================================================================
  // DIRECTORY & PROFILE METHODS
  // ===========================================================================

  public async registerProfile(profile: SignedProfileDocument): Promise<void> {
    this.assertInit();
    const existing = this.profilesByUsername.get(profile.username);
    if (existing && existing.identityId !== profile.identityId) {
      throw new Error('CONFLICT: Username is already registered by another identity');
    }

    // If this identity had a previous username, clean it up
    const prev = this.profilesByIdentity.get(profile.identityId);
    if (prev && prev.username !== profile.username) {
      this.profilesByUsername.delete(prev.username);
    }

    this.profilesByUsername.set(profile.username, { ...profile });
    this.profilesByIdentity.set(profile.identityId, { ...profile });
  }

  public async getProfileByUsername(canonicalUsername: string): Promise<SignedProfileDocument | null> {
    this.assertInit();
    const prof = this.profilesByUsername.get(canonicalUsername);
    if (!prof) return null;
    if (prof.expiresAt && prof.expiresAt <= Date.now()) {
      this.profilesByUsername.delete(canonicalUsername);
      this.profilesByIdentity.delete(prof.identityId);
      return null;
    }
    return { ...prof };
  }

  public async getProfileByIdentity(identityId: string): Promise<SignedProfileDocument | null> {
    this.assertInit();
    const prof = this.profilesByIdentity.get(identityId);
    if (!prof) return null;
    if (prof.expiresAt && prof.expiresAt <= Date.now()) {
      this.profilesByUsername.delete(prof.username);
      this.profilesByIdentity.delete(identityId);
      return null;
    }
    return { ...prof };
  }

  public async searchProfiles(query: string, limit: number): Promise<DirectorySearchResult[]> {
    this.assertInit();
    const q = query.toLowerCase().trim().replace(/^@/, '');
    if (!q) return [];

    const results: DirectorySearchResult[] = [];
    const now = Date.now();

    for (const prof of this.profilesByUsername.values()) {
      if (prof.expiresAt && prof.expiresAt <= now) continue;

      const matchUsername = prof.username.toLowerCase().includes(q);
      const matchDisplayName = prof.displayName.toLowerCase().includes(q);

      if (matchUsername || matchDisplayName) {
        results.push({
          identityId: prof.identityId,
          username: prof.username,
          displayName: prof.displayName,
          avatar: prof.avatar,
          profileSignature: prof.signature,
        });

        if (results.length >= limit) break;
      }
    }

    return results;
  }

  public async deleteProfile(identityId: string): Promise<boolean> {
    this.assertInit();
    const prof = this.profilesByIdentity.get(identityId);
    if (!prof) return false;
    this.profilesByUsername.delete(prof.username);
    this.profilesByIdentity.delete(identityId);
    return true;
  }

  public async close(): Promise<void> {
    this.initialized = false;
  }

  public async destroyStore(): Promise<void> {
    this.mailboxes.clear();
    this.envelopes.clear();
    this.profilesByUsername.clear();
    this.profilesByIdentity.clear();
    this.initialized = false;
  }

  private assertInit(): void {
    if (!this.initialized) {
      throw new Error('MemoryRelayStore is not initialized. Call init() first.');
    }
  }
}
