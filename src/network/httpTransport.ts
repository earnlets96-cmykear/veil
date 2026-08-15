/**
 * HTTP Transport Client for VEIL Relay Communication.
 *
 * Implements typed API requests, request timeouts, error mapping,
 * and TLS enforcement.
 */

import { NetworkConfig } from './types.ts';
import {
  CreateMailboxResponse,
  SendEnvelopeResponse,
  FetchEnvelopesResponse,
  AckEnvelopesResponse,
  RELAY_PROTOCOL_VERSION,
} from '../server/types.ts';
import {
  NetworkError,
  RelayUnavailableError,
  MailboxRevokedError,
  UnauthorizedMailboxError,
  EnvelopePayloadTooLargeError,
  TlsRequiredError,
  ProtocolVersionMismatchError,
} from './errors.ts';

export class HttpTransport {
  private config: NetworkConfig;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.validateUrlSecurity();
  }

  public async checkHealth(): Promise<{ status: string; protocolVersion: string; uptimeSeconds: number }> {
    const res = await this.request<{ status: string; protocolVersion: string; uptimeSeconds: number }>('/healthz', {
      method: 'GET',
    });

    if (res.protocolVersion !== RELAY_PROTOCOL_VERSION) {
      throw new ProtocolVersionMismatchError(
        `Relay protocol version "${res.protocolVersion}" does not match client "${RELAY_PROTOCOL_VERSION}"`
      );
    }

    return res;
  }

  public async createMailbox(ttlSeconds?: number): Promise<CreateMailboxResponse> {
    return this.request<CreateMailboxResponse>('/v1/mailboxes', {
      method: 'POST',
      body: JSON.stringify({ ttlSeconds }),
    });
  }

  public async sendEnvelope(mailboxId: string, payload: string, ttlSeconds?: number): Promise<SendEnvelopeResponse> {
    return this.request<SendEnvelopeResponse>('/v1/envelopes', {
      method: 'POST',
      body: JSON.stringify({ mailboxId, payload, ttlSeconds }),
    });
  }

  public async fetchEnvelopes(
    mailboxId: string,
    capabilityToken: string,
    limit?: number
  ): Promise<FetchEnvelopesResponse> {
    return this.request<FetchEnvelopesResponse>('/v1/envelopes/fetch', {
      method: 'POST',
      body: JSON.stringify({ mailboxId, capabilityToken, limit }),
    });
  }

  public async ackEnvelopes(
    mailboxId: string,
    capabilityToken: string,
    envelopeIds: string[]
  ): Promise<AckEnvelopesResponse> {
    return this.request<AckEnvelopesResponse>('/v1/envelopes/ack', {
      method: 'POST',
      body: JSON.stringify({ mailboxId, capabilityToken, envelopeIds }),
    });
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    const url = `${this.config.httpUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (_e) {
          // ignore non-json error body
        }

        const msg = errorData?.error?.message || `HTTP ${response.status} on ${endpoint}`;

        if (response.status === 401) {
          throw new UnauthorizedMailboxError(msg);
        }
        if (response.status === 404) {
          throw new MailboxRevokedError(msg);
        }
        if (response.status === 413) {
          throw new EnvelopePayloadTooLargeError(msg);
        }
        if (response.status === 503 || response.status === 502) {
          throw new RelayUnavailableError(msg);
        }
        throw new NetworkError(msg);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new NetworkError(`Request to ${endpoint} timed out after ${this.config.requestTimeoutMs}ms`);
      }
      if (err instanceof NetworkError) {
        throw err;
      }
      throw new RelayUnavailableError(`Failed to connect to relay server at ${url}: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private validateUrlSecurity(): void {
    if (this.config.enforceTls) {
      if (!this.config.httpUrl.startsWith('https://')) {
        throw new TlsRequiredError(`Insecure HTTP relay URL "${this.config.httpUrl}" rejected when TLS is enforced.`);
      }
      if (!this.config.wsUrl.startsWith('wss://')) {
        throw new TlsRequiredError(`Insecure WS relay URL "${this.config.wsUrl}" rejected when TLS is enforced.`);
      }
    }
  }
}
