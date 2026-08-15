/**
 * WebSocket Delivery Handler for VEIL Relay Server.
 *
 * Implements near-real-time envelope push, capability authentication,
 * heartbeats, backpressure management, and disconnect cleanup.
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { IRelayStore } from './storage/relayStore.ts';
import { PrivacyLogger } from './logger.ts';
import { RelayServerConfig } from './config.ts';
import { RelayEnvelope, ClientWsMessage, ServerWsMessage } from './types.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '../crypto/utils.ts';

interface ClientState {
  ws: WebSocket;
  ip: string;
  mailboxId?: string;
  isAuthenticated: boolean;
  connectedAt: number;
}

export class WebSocketDeliveryHandler {
  private wss: WebSocketServer;
  private store: IRelayStore;
  private logger: PrivacyLogger;
  private config: RelayServerConfig;

  // Active client tracking
  private clients = new Map<WebSocket, ClientState>();
  private mailboxSubscriptions = new Map<string, Set<WebSocket>>();
  private ipConnectionCounts = new Map<string, number>();

  constructor(wss: WebSocketServer, store: IRelayStore, config: RelayServerConfig, logger: PrivacyLogger) {
    this.wss = wss;
    this.store = store;
    this.config = config;
    this.logger = logger;

    this.setupWss();
  }

  /**
   * Pushes a new envelope in near-real-time to all active authenticated subscriber sockets.
   */
  public pushEnvelope(envelope: RelayEnvelope): number {
    const subscribers = this.mailboxSubscriptions.get(envelope.mailboxId);
    if (!subscribers || subscribers.size === 0) {
      return 0;
    }

    const message: ServerWsMessage = {
      type: 'envelope',
      envelope,
    };
    const payload = JSON.stringify(message);

    let delivered = 0;
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        // Enforce backpressure check: if bufferedAmount is too high, skip/drop
        if (ws.bufferedAmount < 1024 * 1024) { // 1 MB buffer limit
          ws.send(payload);
          delivered++;
        } else {
          this.logger.warn('WebSocket backpressure limit exceeded; dropping frame for slow subscriber');
        }
      }
    }

    return delivered;
  }

  /**
   * Gracefully terminates all active WebSocket connections.
   */
  public closeAll(): void {
    for (const ws of this.clients.keys()) {
      try {
        ws.close(1001, 'Server shutting down');
      } catch (_e) {
        // Ignore close errors during shutdown
      }
    }
    this.clients.clear();
    this.mailboxSubscriptions.clear();
    this.ipConnectionCounts.clear();
  }

  private setupWss(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

      // Check max connections per IP
      const currentIpCount = this.ipConnectionCounts.get(ip) || 0;
      if (currentIpCount >= this.config.maxWsConnectionsPerIp) {
        this.logger.warn('WebSocket connection rejected: per-IP connection limit exceeded');
        ws.close(1008, 'Connection limit exceeded');
        return;
      }

      this.ipConnectionCounts.set(ip, currentIpCount + 1);

      const state: ClientState = {
        ws,
        ip,
        isAuthenticated: false,
        connectedAt: Date.now(),
      };
      this.clients.set(ws, state);

      ws.on('message', async (data: Buffer | string) => {
        await this.handleClientMessage(state, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(state);
      });

      ws.on('error', (err) => {
        this.logger.debug('WebSocket error encountered:', { message: err.message });
      });
    });
  }

  private async handleClientMessage(state: ClientState, raw: Buffer | string): Promise<void> {
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      if (text.length > 65536) {
        this.sendError(state.ws, 'PAYLOAD_TOO_LARGE', 'WebSocket message too large');
        return;
      }

      const msg = JSON.parse(text) as ClientWsMessage;

      switch (msg.type) {
        case 'auth':
          await this.handleAuth(state, msg.mailboxId, msg.capabilityToken);
          break;
        case 'ping':
          this.sendMessage(state.ws, { type: 'pong' });
          break;
        case 'ack':
          await this.handleAck(state, msg.envelopeIds);
          break;
        default:
          this.sendError(state.ws, 'BAD_REQUEST', 'Unknown message type');
      }
    } catch (_err) {
      this.sendError(state.ws, 'BAD_REQUEST', 'Malformed WebSocket JSON payload');
    }
  }

  private async handleAuth(state: ClientState, mailboxId: string, capabilityToken: string): Promise<void> {
    if (!mailboxId || !capabilityToken) {
      this.sendError(state.ws, 'BAD_REQUEST', 'Missing mailboxId or capabilityToken');
      return;
    }

    const mailbox = await this.store.getMailbox(mailboxId);
    if (!mailbox) {
      this.sendError(state.ws, 'NOT_FOUND', 'Mailbox not found');
      return;
    }

    // Verify capability hash
    const tokenHash = bytesToHex(sha256(new TextEncoder().encode(capabilityToken)));
    if (tokenHash !== mailbox.capabilityHash) {
      this.sendError(state.ws, 'UNAUTHORIZED', 'Invalid capability token');
      return;
    }

    // Unsubscribe from previous mailbox if switching
    if (state.mailboxId && state.mailboxId !== mailboxId) {
      this.unsubscribe(state.ws, state.mailboxId);
    }

    state.mailboxId = mailboxId;
    state.isAuthenticated = true;

    // Register subscription
    let subs = this.mailboxSubscriptions.get(mailboxId);
    if (!subs) {
      subs = new Set();
      this.mailboxSubscriptions.set(mailboxId, subs);
    }
    subs.add(state.ws);

    this.sendMessage(state.ws, { type: 'authenticated', mailboxId });
  }

  private async handleAck(state: ClientState, envelopeIds: string[]): Promise<void> {
    if (!state.isAuthenticated || !state.mailboxId) {
      this.sendError(state.ws, 'UNAUTHORIZED', 'Socket is not authenticated for a mailbox');
      return;
    }

    if (!Array.isArray(envelopeIds) || envelopeIds.length === 0) {
      this.sendError(state.ws, 'BAD_REQUEST', 'Invalid envelopeIds array');
      return;
    }

    const count = await this.store.deleteEnvelopes(state.mailboxId, envelopeIds);
    this.sendMessage(state.ws, { type: 'ack_confirm', acknowledgedCount: count });
  }

  private handleDisconnect(state: ClientState): void {
    this.clients.delete(state.ws);

    // Unsubscribe
    if (state.mailboxId) {
      this.unsubscribe(state.ws, state.mailboxId);
    }

    // Decrement IP count
    const ipCount = this.ipConnectionCounts.get(state.ip) || 1;
    if (ipCount <= 1) {
      this.ipConnectionCounts.delete(state.ip);
    } else {
      this.ipConnectionCounts.set(state.ip, ipCount - 1);
    }
  }

  private unsubscribe(ws: WebSocket, mailboxId: string): void {
    const subs = this.mailboxSubscriptions.get(mailboxId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) {
        this.mailboxSubscriptions.delete(mailboxId);
      }
    }
  }

  private sendMessage(ws: WebSocket, msg: ServerWsMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private sendError(ws: WebSocket, code: any, message: string): void {
    this.sendMessage(ws, { type: 'error', code, message });
  }
}
