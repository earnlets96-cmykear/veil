/**
 * Persistent File-Backed Relay Store Implementation for VEIL Relay Server.
 *
 * Implements IRelayStore with filesystem persistence, atomic write-rename semantics,
 * mailbox isolation, and TTL sweep garbage collection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { IRelayStore } from './relayStore.ts';
import { RelayEnvelope, MailboxRecord } from '../types.ts';

export class PersistentFileRelayStore implements IRelayStore {
  private baseDir: string;
  private mailboxesFile: string;
  private envelopesDir: string;
  private mailboxes = new Map<string, MailboxRecord>();
  private envelopes = new Map<string, Map<string, RelayEnvelope>>();
  private initialized = false;

  constructor(baseDir = path.join(process.cwd(), '.veil_relay_data')) {
    this.baseDir = baseDir;
    this.mailboxesFile = path.join(baseDir, 'mailboxes.json');
    this.envelopesDir = path.join(baseDir, 'envelopes');
  }

  public async init(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.envelopesDir)) {
      fs.mkdirSync(this.envelopesDir, { recursive: true });
    }

    // Load persisted mailboxes
    if (fs.existsSync(this.mailboxesFile)) {
      try {
        const raw = fs.readFileSync(this.mailboxesFile, 'utf8');
        const list: MailboxRecord[] = JSON.parse(raw);
        for (const mb of list) {
          this.mailboxes.set(mb.mailboxId, mb);
          this.envelopes.set(mb.mailboxId, new Map());
        }
      } catch (_e) {}
    }

    // Load persisted envelopes
    for (const mailboxId of this.mailboxes.keys()) {
      const mbFile = path.join(this.envelopesDir, `${mailboxId}.json`);
      if (fs.existsSync(mbFile)) {
        try {
          const raw = fs.readFileSync(mbFile, 'utf8');
          const envList: RelayEnvelope[] = JSON.parse(raw);
          const queue = new Map<string, RelayEnvelope>();
          for (const env of envList) {
            queue.set(env.envelopeId, env);
          }
          this.envelopes.set(mailboxId, queue);
        } catch (_e) {}
      }
    }

    this.initialized = true;
  }

  public async createMailbox(record: MailboxRecord): Promise<void> {
    this.assertInit();
    this.mailboxes.set(record.mailboxId, { ...record });
    if (!this.envelopes.has(record.mailboxId)) {
      this.envelopes.set(record.mailboxId, new Map());
    }
    await this.persistMailboxes();
  }

  public async getMailbox(mailboxId: string): Promise<MailboxRecord | null> {
    this.assertInit();
    const mb = this.mailboxes.get(mailboxId);
    return mb ? { ...mb } : null;
  }

  public async deleteMailbox(mailboxId: string): Promise<boolean> {
    this.assertInit();
    const existed = this.mailboxes.delete(mailboxId);
    this.envelopes.delete(mailboxId);

    const mbFile = path.join(this.envelopesDir, `${mailboxId}.json`);
    if (fs.existsSync(mbFile)) {
      try {
        fs.unlinkSync(mbFile);
      } catch (_e) {}
    }

    await this.persistMailboxes();
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
    await this.persistMailboxEnvelopes(envelope.mailboxId);
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
    return Array.from(queue.values())
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit);
  }


  public async deleteEnvelopes(mailboxId: string, envelopeIds: string[]): Promise<number> {
    this.assertInit();
    const queue = this.envelopes.get(mailboxId);
    if (!queue) return 0;
    let count = 0;
    for (const id of envelopeIds) {
      if (queue.delete(id)) count++;
    }
    if (count > 0) {
      await this.persistMailboxEnvelopes(mailboxId);
    }
    return count;
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

    for (const [mailboxId, record] of Array.from(this.mailboxes.entries())) {
      if (record.expiresAt && record.expiresAt <= now) {
        await this.deleteMailbox(mailboxId);
        expiredMailboxes++;
        continue;
      }

      const queue = this.envelopes.get(mailboxId);
      if (queue) {
        let changed = false;
        for (const [envId, envelope] of Array.from(queue.entries())) {
          if (envelope.expiresAt <= now) {
            queue.delete(envId);
            expiredEnvelopes++;
            changed = true;
          }
        }
        if (changed) {
          await this.persistMailboxEnvelopes(mailboxId);
        }
      }
    }

    return { expiredMailboxes, expiredEnvelopes };
  }

  public async close(): Promise<void> {
    this.initialized = false;
  }

  public async destroyStore(): Promise<void> {
    this.mailboxes.clear();
    this.envelopes.clear();
    if (fs.existsSync(this.baseDir)) {
      try {
        fs.rmSync(this.baseDir, { recursive: true, force: true });
      } catch (_e) {}
    }
    this.initialized = false;
  }

  private async persistMailboxes(): Promise<void> {
    const list = Array.from(this.mailboxes.values());
    const tmp = `${this.mailboxesFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, this.mailboxesFile);
  }

  private async persistMailboxEnvelopes(mailboxId: string): Promise<void> {
    const queue = this.envelopes.get(mailboxId);
    const list = queue ? Array.from(queue.values()) : [];
    const mbFile = path.join(this.envelopesDir, `${mailboxId}.json`);
    const tmp = `${mbFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, mbFile);
  }

  private assertInit(): void {
    if (!this.initialized) {
      throw new Error('PersistentFileRelayStore: Store is not initialized');
    }
  }
}
