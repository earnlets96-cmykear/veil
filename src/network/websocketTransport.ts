/**
 * WebSocket Transport Client for VEIL Relay Communication.
 *
 * Implements connection lifecycle management, mailbox capability authentication,
 * periodic heartbeats, and exponential backoff with jitter.
 */

import { WebSocket } from 'ws';
import { NetworkConfig, NetworkState } from './types.ts';
import { RelayEnvelope, ClientWsMessage, ServerWsMessage } from '../server/types.ts';

export class WebSocketTransport {
  private config: NetworkConfig;
  private ws: WebSocket | null = null;
  private state: NetworkState = 'offline';
  private mailboxId: string | null = null;
  private capabilityToken: string | null = null;

  // Handlers
  private envelopeListeners: ((envelope: RelayEnvelope) => void)[] = [];
  private stateListeners: ((state: NetworkState) => void)[] = [];

  // Timers & Reconnect state
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private retryCount = 0;
  private isExplicitlyClosed = false;

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  public getState(): NetworkState {
    return this.state;
  }

  public onEnvelope(listener: (envelope: RelayEnvelope) => void): () => void {
    this.envelopeListeners.push(listener);
    return () => {
      this.envelopeListeners = this.envelopeListeners.filter(l => l !== listener);
    };
  }

  public onStateChange(listener: (state: NetworkState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  /**
   * Connects to the relay WebSocket endpoint and authenticates the mailbox capability.
   */
  public async connect(mailboxId: string, capabilityToken: string): Promise<void> {
    this.mailboxId = mailboxId;
    this.capabilityToken = capabilityToken;
    this.isExplicitlyClosed = false;
    this.retryCount = 0;

    return this.establishConnection();
  }

  /**
   * Closes the active WebSocket connection cleanly.
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearTimers();

    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect');
      } catch (_e) {
        // ignore close error
      }
      this.ws = null;
    }

    this.setState('offline');
  }

  /**
   * Sends an ACK message for received envelopes over the active WebSocket channel.
   */
  public sendAck(envelopeIds: string[]): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state === 'connected') {
      const msg: ClientWsMessage = { type: 'ack', envelopeIds };
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  private async establishConnection(): Promise<void> {
    this.clearTimers();
    this.setState(this.retryCount > 0 ? 'reconnecting' : 'connecting');

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);
      } catch (err: any) {
        this.handleConnectionFailure();
        return reject(err);
      }

      let authResolved = false;

      const connectTimeout = setTimeout(() => {
        if (!authResolved) {
          authResolved = true;
          this.ws?.close();
          this.handleConnectionFailure();
          reject(new Error('WebSocket connection timed out'));
        }
      }, this.config.connectTimeoutMs);

      this.ws.on('open', () => {
        // Authenticate immediately upon connection
        if (this.mailboxId && this.capabilityToken) {
          const authMsg: ClientWsMessage = {
            type: 'auth',
            mailboxId: this.mailboxId,
            capabilityToken: this.capabilityToken,
          };
          this.ws?.send(JSON.stringify(authMsg));
        }
      });

      this.ws.on('message', (raw: Buffer | string) => {
        try {
          const text = typeof raw === 'string' ? raw : raw.toString('utf8');
          const msg = JSON.parse(text) as ServerWsMessage;

          if (msg.type === 'authenticated') {
            clearTimeout(connectTimeout);
            this.retryCount = 0;
            this.setState('connected');
            this.startHeartbeat();
            if (!authResolved) {
              authResolved = true;
              resolve();
            }
          } else if (msg.type === 'envelope') {
            this.dispatchEnvelope(msg.envelope);
          } else if (msg.type === 'error') {
            if (!authResolved) {
              clearTimeout(connectTimeout);
              authResolved = true;
              reject(new Error(`WebSocket authentication error: ${msg.message}`));
            }
          }
        } catch (_e) {
          // Ignore malformed message frames
        }
      });

      this.ws.on('close', () => {
        clearTimeout(connectTimeout);
        this.clearTimers();
        if (!this.isExplicitlyClosed) {
          this.handleConnectionFailure();
        }
      });

      this.ws.on('error', (_err) => {
        clearTimeout(connectTimeout);
        if (!authResolved) {
          authResolved = true;
          this.handleConnectionFailure();
          reject(new Error('WebSocket connection error'));
        }
      });
    });
  }

  private handleConnectionFailure(): void {
    if (this.isExplicitlyClosed) return;

    this.setState('degraded');
    this.retryCount++;

    if (this.retryCount > this.config.maxRetries) {
      this.setState('error');
      return;
    }

    // Compute exponential backoff with jitter
    const baseDelay = this.config.initialRetryDelayMs * Math.pow(this.config.retryBackoffMultiplier, this.retryCount - 1);
    const jitter = Math.random() * 500;
    const delay = Math.min(baseDelay + jitter, this.config.maxRetryDelayMs);

    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitlyClosed && this.mailboxId && this.capabilityToken) {
        this.establishConnection().catch(() => {});
      }
    }, delay);

    if (this.reconnectTimer.unref) {
      this.reconnectTimer.unref();
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const ping: ClientWsMessage = { type: 'ping' };
        this.ws.send(JSON.stringify(ping));
      }
    }, this.config.heartbeatIntervalMs);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private setState(state: NetworkState): void {
    if (this.state !== state) {
      this.state = state;
      for (const listener of this.stateListeners) {
        try {
          listener(state);
        } catch (_e) {}
      }
    }
  }

  private dispatchEnvelope(envelope: RelayEnvelope): void {
    for (const listener of this.envelopeListeners) {
      try {
        listener(envelope);
      } catch (_e) {}
    }
  }
}
