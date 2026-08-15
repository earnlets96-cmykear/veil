/**
 * Untrusted Mock Transport Server for VEIL.
 *
 * Implements the minimal blind mailbox routing protocol:
 * - Stores opaque envelopes indexed solely by mailboxId.
 * - Authenticates requests using client capabilities against stored SHA-256 verifiers.
 * - Maintains zero user profiles, zero passwords, zero SMKs, and zero private keys.
 * - Supports TTL expiration purging and failure simulation for adversarial testing.
 */

import {
  ITransportAdapter,
  TransportEnvelope,
  ServerMailboxRecord,
  MailboxStatus,
} from './types.ts';
import { verifyCapability } from './capability.ts';
import { validateTransportEnvelope } from './envelope.ts';

export interface ServerDatabaseDump {
  mailboxes: {
    mailboxId: string;
    verifier: string;
    createdAt: number;
    envelopeCount: number;
    envelopeIds: string[];
  }[];
}

export class MockTransportServer implements ITransportAdapter {
  private mailboxes = new Map<string, ServerMailboxRecord>();
  private requestCount = 0;

  // Failure simulation flags for adversarial testing
  public simulateOffline = false;
  public simulateTimeout = false;
  public simulateCorruptPayload = false;
  public simulateTruncatedResponse = false;

  /**
   * Registers a new blind mailbox on the server.
   *
   * @param mailboxId Opaque 32-byte hex string
   * @param verifier Base64 SHA-256 verifier of the capability
   */
  public async createMailbox(mailboxId: string, verifier: string): Promise<boolean> {
    this.checkSimulatedNetwork();

    if (!mailboxId || !verifier) {
      throw new Error('Server: invalid mailbox registration parameters');
    }

    if (this.mailboxes.has(mailboxId)) {
      // Re-registration with same mailbox ID is rejected
      return false;
    }

    this.mailboxes.set(mailboxId, {
      mailboxId,
      verifier,
      createdAt: Date.now(),
      envelopes: new Map(),
    });

    return true;
  }

  /**
   * Posts an opaque transport envelope to a target mailbox.
   * Does NOT require sender authentication (blind drop model).
   */
  public async postEnvelope(envelope: TransportEnvelope): Promise<boolean> {
    this.checkSimulatedNetwork();

    if (!validateTransportEnvelope(envelope)) {
      return false;
    }

    const mb = this.mailboxes.get(envelope.mailboxId);
    if (!mb) {
      // Mailbox not found on server
      return false;
    }

    // Check for duplicate envelopeId
    if (mb.envelopes.has(envelope.envelopeId)) {
      // Already stored (idempotent acceptance)
      return true;
    }

    mb.envelopes.set(envelope.envelopeId, { ...envelope });
    return true;
  }

  /**
   * Fetches envelopes from a mailbox using the client's capability secret.
   */
  public async fetchEnvelopes(
    mailboxId: string,
    capability: string,
    limit = 50
  ): Promise<TransportEnvelope[]> {
    this.checkSimulatedNetwork();

    const mb = this.mailboxes.get(mailboxId);
    if (!mb) {
      throw new Error('Server: mailbox not found');
    }

    // Authenticate capability against stored verifier
    if (!verifyCapability(capability, mb.verifier)) {
      throw new Error('Server: unauthorized - invalid mailbox capability');
    }

    // Purge expired envelopes before returning
    const now = Date.now();
    const result: TransportEnvelope[] = [];

    for (const [id, env] of mb.envelopes.entries()) {
      if (env.expiresAt <= now) {
        mb.envelopes.delete(id);
      } else {
        let payloadToReturn = env.payload;
        if (this.simulateCorruptPayload) {
          payloadToReturn = 'CORRUPTED_BLOB_!!!';
        }

        result.push({
          ...env,
          payload: payloadToReturn,
        });

        if (result.length >= limit) break;
      }
    }

    if (this.simulateTruncatedResponse && result.length > 1) {
      return result.slice(0, 1);
    }

    return result;
  }

  /**
   * Acknowledges and removes an envelope from a mailbox.
   */
  public async acknowledgeEnvelope(
    mailboxId: string,
    capability: string,
    envelopeId: string
  ): Promise<boolean> {
    this.checkSimulatedNetwork();

    const mb = this.mailboxes.get(mailboxId);
    if (!mb) return false;

    if (!verifyCapability(capability, mb.verifier)) {
      throw new Error('Server: unauthorized - invalid mailbox capability');
    }

    return mb.envelopes.delete(envelopeId);
  }

  /**
   * Deletes an entire mailbox from the server.
   */
  public async deleteMailbox(mailboxId: string, capability: string): Promise<boolean> {
    this.checkSimulatedNetwork();

    const mb = this.mailboxes.get(mailboxId);
    if (!mb) return false;

    if (!verifyCapability(capability, mb.verifier)) {
      throw new Error('Server: unauthorized - invalid mailbox capability');
    }

    return this.mailboxes.delete(mailboxId);
  }

  /**
   * Queries status of a mailbox.
   */
  public async getMailboxStatus(mailboxId: string, capability: string): Promise<MailboxStatus | null> {
    this.checkSimulatedNetwork();

    const mb = this.mailboxes.get(mailboxId);
    if (!mb) return null;

    if (!verifyCapability(capability, mb.verifier)) {
      throw new Error('Server: unauthorized - invalid mailbox capability');
    }

    const envs = Array.from(mb.envelopes.values());
    return {
      mailboxId,
      envelopeCount: envs.length,
      oldestCreatedAt: envs.length > 0 ? Math.min(...envs.map(e => e.createdAt)) : undefined,
      newestCreatedAt: envs.length > 0 ? Math.max(...envs.map(e => e.createdAt)) : undefined,
    };
  }

  /**
   * Automatically purges all expired envelopes across all mailboxes.
   */
  public purgeExpired(now = Date.now()): number {
    let purged = 0;
    for (const mb of this.mailboxes.values()) {
      for (const [id, env] of mb.envelopes.entries()) {
        if (env.expiresAt <= now) {
          mb.envelopes.delete(id);
          purged++;
        }
      }
    }
    return purged;
  }

  /**
   * Dumps server database metadata for adversarial security audits.
   */
  public inspectDatabase(): ServerDatabaseDump {
    return {
      mailboxes: Array.from(this.mailboxes.values()).map(mb => ({
        mailboxId: mb.mailboxId,
        verifier: mb.verifier,
        createdAt: mb.createdAt,
        envelopeCount: mb.envelopes.size,
        envelopeIds: Array.from(mb.envelopes.keys()),
      })),
    };
  }

  /**
   * Resets all server data.
   */
  public reset(): void {
    this.mailboxes.clear();
    this.simulateOffline = false;
    this.simulateTimeout = false;
    this.simulateCorruptPayload = false;
    this.simulateTruncatedResponse = false;
  }

  private checkSimulatedNetwork(): void {
    this.requestCount++;
    if (this.simulateOffline) {
      throw new Error('Network error: server is unreachable (offline)');
    }
    if (this.simulateTimeout) {
      throw new Error('Network error: request timed out');
    }
  }
}
