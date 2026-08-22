/**
 * Top-Level Client Network Manager for VEIL.
 *
 * Coordinates HTTP and WebSocket transports, per-Space mailbox bindings,
 * offline persistent queuing, ACK-after-persistence delivery, and E2EE payload routing.
 *
 * CRITICAL INVARIANT:
 * - Untrusted Blind Relay: Sends and receives opaque ciphertext payloads only.
 * - Strict Per-Space Isolation: Distinct mailbox capabilities and queues per Space.
 */

import { SpaceSession } from '../spaces/session.ts';
import { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { HttpTransport } from './httpTransport.ts';
import { WebSocketTransport } from './websocketTransport.ts';
import { EnvelopeQueue } from './envelopeQueue.ts';
import {
  NetworkConfig,
  DEFAULT_NETWORK_CONFIG,
  SpaceMailboxBinding,
  QueuedOutboundEnvelope,
  QueuedInboundEnvelope,
  NetworkState,
} from './types.ts';
import { randomBytes, bytesToHex } from '../crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { RelayEnvelope } from '../server/types.ts';

function maskMailbox(mailboxId: string): string {
  if (!mailboxId) return 'unknown';
  return bytesToHex(sha256(new TextEncoder().encode(mailboxId))).slice(0, 8);
}

const KEY_MAILBOX_BINDING = 'net_mailbox_binding';

export class NetworkManager {
  private config: NetworkConfig;
  private store: EncryptedSpaceStore;
  private queue: EnvelopeQueue;
  private http: HttpTransport;

  // Active WebSocket transports keyed by spaceId
  private activeWsTransports = new Map<string, WebSocketTransport>();
  private messageHandlers = new Map<string, (payload: string) => Promise<void>>();
  private stateListeners: ((state: NetworkState) => void)[] = [];
  private lastKnownState: NetworkState = 'offline';

  constructor(store: EncryptedSpaceStore, config: Partial<NetworkConfig> = {}) {
    this.store = store;
    this.config = { ...DEFAULT_NETWORK_CONFIG, ...config };
    this.queue = new EnvelopeQueue(store);
    this.http = new HttpTransport(this.config);
  }

  public getHttp(): HttpTransport {
    return this.http;
  }

  public getQueue(): EnvelopeQueue {
    return this.queue;
  }

  public getConfig(): NetworkConfig {
    return this.config;
  }

  public getState(session?: SpaceSession): NetworkState {
    if (session) {
      const ws = this.activeWsTransports.get(session.spaceId);
      if (ws) return ws.getState();
    }
    return this.lastKnownState;
  }

  public onStateChange(listener: (state: NetworkState) => void): () => void {
    this.stateListeners.push(listener);
    // Emit current state immediately
    listener(this.lastKnownState);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  private emitStateChange(state: NetworkState): void {
    this.lastKnownState = state;
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (_e) {}
    }
  }

  // ===========================================================================
  // MAILBOX BINDING MANAGEMENT
  // ===========================================================================

  /**
   * Retrieves the persisted mailbox binding for an active Space, or creates a new one on the relay.
   */
  public async getOrCreateMailbox(session: SpaceSession, forceNew = false): Promise<SpaceMailboxBinding> {
    this.assertSession(session);

    if (!forceNew) {
      const binding = await this.store.getAsync<SpaceMailboxBinding>(session, KEY_MAILBOX_BINDING);
      if (binding && binding.expiresAt > Date.now()) {
        return binding;
      }
    }

    // Allocate new blind mailbox on relay
    const res = await this.http.createMailbox();
    const binding: SpaceMailboxBinding = {
      spaceId: session.spaceId,
      mailboxId: res.mailboxId,
      capabilityToken: res.capabilityToken,
      expiresAt: res.expiresAt,
      lastSyncAt: Date.now(),
    };

    // Save encrypted under Space StorageKey
    await this.store.setAsync(session, KEY_MAILBOX_BINDING, binding);
    return binding;
  }

  public async getMailboxBinding(session: SpaceSession): Promise<SpaceMailboxBinding | null> {
    this.assertSession(session);
    return this.store.getAsync<SpaceMailboxBinding>(session, KEY_MAILBOX_BINDING);
  }

  // ===========================================================================
  // OUTBOUND MESSAGING PIPELINE
  // ===========================================================================

  /**
   * Submits an opaque ciphertext envelope to a target mailbox.
   * If online, sends immediately to relay. If offline, enqueues persistently.
   */
  public async sendEnvelope(
    session: SpaceSession,
    targetMailboxId: string,
    payload: string,
    ttlSeconds?: number
  ): Promise<QueuedOutboundEnvelope> {
    this.assertSession(session);

    const queueId = bytesToHex(randomBytes(16));
    const item: QueuedOutboundEnvelope = {
      queueId,
      spaceId: session.spaceId,
      mailboxId: targetMailboxId,
      payload,
      ttlSeconds,
      status: 'QUEUED',
      createdAt: Date.now(),
      retryCount: 0,
    };

    // 1. Always persist to encrypted outbound queue first (crash safety)
    await this.queue.enqueueOutbound(session, item);

    // 2. Attempt immediate dispatch over HTTP
    try {
      await this.queue.updateOutboundStatus(session, queueId, 'SENDING');
      await this.http.sendEnvelope(targetMailboxId, payload, ttlSeconds);
      
      // Successfully accepted by relay -> remove from outbound queue
      await this.queue.removeOutbound(session, queueId);
      item.status = 'SENT_TO_RELAY';
      if (typeof console !== 'undefined' && console.debug) {
        console.debug(`[VEIL-NET] Outbound: queueId=${queueId.slice(0, 8)}, mailbox=${maskMailbox(targetMailboxId)}, transport=http, state=SENT_TO_RELAY`);
      }
    } catch (err: any) {
      // Keep in queue for automatic drain upon reconnect
      await this.queue.updateOutboundStatus(session, queueId, 'QUEUED', err.message);
      item.status = 'QUEUED';
      item.errorMessage = err.message;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[VEIL-NET] Outbound failed: queueId=${queueId.slice(0, 8)}, mailbox=${maskMailbox(targetMailboxId)}, error=${err.name}: ${err.message}`);
      }
    }

    return item;
  }

  /**
   * Flushes all pending outbound envelopes in the Space's encrypted queue.
   */
  public async flushOutboundQueue(session: SpaceSession): Promise<number> {
    this.assertSession(session);

    const pending = await this.queue.listOutbound(session);
    let flushedCount = 0;

    for (const item of pending) {
      try {
        await this.queue.updateOutboundStatus(session, item.queueId, 'SENDING');
        await this.http.sendEnvelope(item.mailboxId, item.payload, item.ttlSeconds);
        await this.queue.removeOutbound(session, item.queueId);
        flushedCount++;
        if (typeof console !== 'undefined' && console.debug) {
          console.debug(`[VEIL-NET] Outbound flush: queueId=${item.queueId.slice(0, 8)}, mailbox=${maskMailbox(item.mailboxId)}, state=SENT_TO_RELAY`);
        }
      } catch (err: any) {
        await this.queue.updateOutboundStatus(session, item.queueId, 'QUEUED', err.message);
        break; // Stop draining on connection failure
      }
    }

    return flushedCount;
  }

  // ===========================================================================
  // INBOUND MESSAGING & WEBSOCKET LISTENER
  // ===========================================================================

  /**
   * Connects WebSocket real-time delivery channel and performs initial HTTP fetch sync.
   */
  public async startListening(
    session: SpaceSession,
    onMessageReceived?: (payload: string) => Promise<void>
  ): Promise<void> {
    this.assertSession(session);

    const binding = await this.getOrCreateMailbox(session);
    if (onMessageReceived) {
      this.messageHandlers.set(session.spaceId, onMessageReceived);
    }

    let wsTransport = this.activeWsTransports.get(session.spaceId);
    if (!wsTransport) {
      wsTransport = new WebSocketTransport(this.config);
      this.activeWsTransports.set(session.spaceId, wsTransport);

      // Handle incoming push envelopes
      wsTransport.onEnvelope(async (envelope) => {
        await this.processInboundEnvelope(session, envelope, wsTransport);
      });

      // Forward network state changes in real time
      wsTransport.onStateChange((state) => {
        this.emitStateChange(state);
      });
    }

    // Connect & authenticate WebSocket
    try {
      await wsTransport.connect(binding.mailboxId, binding.capabilityToken);
    } catch (_err) {
      // Falls back to HTTP polling if WebSocket is temporarily unavailable
      this.emitStateChange('degraded');
    }

    // Perform initial catch-up synchronization over HTTP
    await this.syncMailbox(session, onMessageReceived);
  }

  /**
   * Disconnects WebSocket and halts networking for the Space.
   */
  public stopListening(session: SpaceSession): void {
    const wsTransport = this.activeWsTransports.get(session.spaceId);
    if (wsTransport) {
      wsTransport.disconnect();
      this.activeWsTransports.delete(session.spaceId);
    }
    this.messageHandlers.delete(session.spaceId);
    if (this.activeWsTransports.size === 0) {
      this.emitStateChange('offline');
    }
  }

  /**
   * Manually fetches pending envelopes from relay over HTTP and processes them.
   */
  public async syncMailbox(
    session: SpaceSession,
    onMessageReceived?: (payload: string) => Promise<void>
  ): Promise<number> {
    this.assertSession(session);

    const binding = await this.getMailboxBinding(session);
    if (!binding) return 0;

    const handler = onMessageReceived || this.messageHandlers.get(session.spaceId);
    let totalProcessed = 0;

    try {
      const fetchRes = await this.http.fetchEnvelopes(binding.mailboxId, binding.capabilityToken);
      if (fetchRes.envelopes.length === 0) return 0;

      const ackIds: string[] = [];

      for (const env of fetchRes.envelopes) {
        const queueId = bytesToHex(randomBytes(16));
        const inbound: QueuedInboundEnvelope = {
          queueId,
          spaceId: session.spaceId,
          mailboxId: env.mailboxId,
          envelopeId: env.envelopeId,
          payload: env.payload,
          status: 'QUEUED',
          receivedAt: Date.now(),
        };

        // 1. Enqueue inbound locally with deduplication
        const isNew = await this.queue.enqueueInbound(session, inbound);
        if (isNew && handler) {
          try {
            // 2. Deliver to E2EE decryptor
            await handler(env.payload);
            await this.queue.markInboundProcessed(session, queueId);
            totalProcessed++;
            if (typeof console !== 'undefined' && console.debug) {
              console.debug(`[VEIL-NET] Inbound (poll): envId=${env.envelopeId.slice(0, 8)}, mailbox=${maskMailbox(env.mailboxId)}, persisted=true`);
            }
          } catch (err: any) {
            console.error(`[VEIL-NET] Inbound (poll) processing error for envId=${env.envelopeId.slice(0, 8)}:`, err?.name || 'Error', err?.message || err);
          }
        }

        ackIds.push(env.envelopeId);
      }

      // 3. ACK-after-persistence: Acknowledge processed envelopes to relay
      if (ackIds.length > 0) {
        await this.http.ackEnvelopes(binding.mailboxId, binding.capabilityToken, ackIds);
        if (typeof console !== 'undefined' && console.debug) {
          console.debug(`[VEIL-NET] ACKed ${ackIds.length} envelopes via HTTP for mailbox=${maskMailbox(binding.mailboxId)}`);
        }
      }

      // Flush any queued outbound envelopes
      await this.flushOutboundQueue(session);
    } catch (err: any) {
      if (
        err?.name === 'MailboxRevokedError' ||
        err?.message?.includes('404') ||
        err?.message?.includes('not found') ||
        err?.message?.includes('expired')
      ) {
        try {
          // Server restarted or mailbox expired -> reallocate fresh mailbox
          await this.getOrCreateMailbox(session, true);
          await this.startListening(session, handler);
        } catch (_rebindErr) {}
      }
    }

    return totalProcessed;
  }

  private async processInboundEnvelope(
    session: SpaceSession,
    envelope: RelayEnvelope,
    wsTransport?: WebSocketTransport
  ): Promise<void> {
    const queueId = bytesToHex(randomBytes(16));
    const inbound: QueuedInboundEnvelope = {
      queueId,
      spaceId: session.spaceId,
      mailboxId: envelope.mailboxId,
      envelopeId: envelope.envelopeId,
      payload: envelope.payload,
      status: 'QUEUED',
      receivedAt: Date.now(),
    };

    // 1. Persist to local queue (deduplicating)
    const isNew = await this.queue.enqueueInbound(session, inbound);
    if (!isNew) {
      // Already processed duplicate -> ACK immediately to purge relay
      wsTransport?.sendAck([envelope.envelopeId]);
      return;
    }

    const handler = this.messageHandlers.get(session.spaceId);
    if (handler) {
      try {
        // 2. Process through E2EE cryptographic layer
        await handler(envelope.payload);
        await this.queue.markInboundProcessed(session, queueId);

        // 3. ACK to relay ONLY after safe local processing
        const ackedViaWs = wsTransport?.sendAck([envelope.envelopeId]);
        if (!ackedViaWs) {
          const binding = await this.getMailboxBinding(session);
          if (binding) {
            await this.http.ackEnvelopes(binding.mailboxId, binding.capabilityToken, [envelope.envelopeId]);
          }
        }
        await this.queue.markInboundAcknowledged(session, queueId);
        if (typeof console !== 'undefined' && console.debug) {
          console.debug(`[VEIL-NET] Inbound (ws): envId=${envelope.envelopeId.slice(0, 8)}, mailbox=${maskMailbox(envelope.mailboxId)}, persisted=true, acked=true`);
        }
      } catch (err: any) {
        console.error(`[VEIL-NET] Inbound (ws) processing error for envId=${envelope.envelopeId.slice(0, 8)}:`, err?.name || 'Error', err?.message || err);
      }
    }
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('NetworkManager cannot operate on locked or destroyed SpaceSession');
    }
  }
}
