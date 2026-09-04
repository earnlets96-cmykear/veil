/**
 * Client Networking Subsystem Types for VEIL.
 *
 * Defines network connection states, delivery statuses, queue records,
 * and per-Space mailbox bindings.
 */

import { RelayEnvelope, RELAY_PROTOCOL_VERSION } from '../server/types.ts';

export type NetworkState =
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'stopped'
  | 'error';

export type DeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'UPLOADING'
  | 'SENT_TO_RELAY'
  | 'DELIVERED_TO_RECIPIENT'
  | 'READ'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED';

export interface SpaceMailboxBinding {
  spaceId: string;
  mailboxId: string;
  capabilityToken: string;
  expiresAt: number;
  lastSyncAt: number;
}

export interface QueuedOutboundEnvelope {
  queueId: string;
  spaceId: string;
  mailboxId: string;
  payload: string; // Base64 ciphertext
  ttlSeconds?: number;
  status: DeliveryStatus;
  createdAt: number;
  retryCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  messageId?: string;
  conversationId?: string;
}

export interface QueuedInboundEnvelope {
  queueId: string;
  spaceId: string;
  mailboxId: string;
  envelopeId: string;
  payload: string; // Base64 ciphertext
  status: DeliveryStatus;
  receivedAt: number;
  processedAt?: number;
  acknowledgedAt?: number;
}

export interface NetworkConfig {
  httpUrl: string;
  wsUrl: string;
  requestTimeoutMs: number;
  connectTimeoutMs: number;
  heartbeatIntervalMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
  maxRetryDelayMs: number;
  retryBackoffMultiplier: number;
  enforceTls: boolean;
  maxConcurrentOutbound: number;
}

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  httpUrl: 'http://127.0.0.1:8080',
  wsUrl: 'ws://127.0.0.1:8080/v1/ws',
  requestTimeoutMs: 10000,
  connectTimeoutMs: 10000,
  heartbeatIntervalMs: 15000,
  maxRetries: 5,
  initialRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  retryBackoffMultiplier: 2.0,
  enforceTls: false, // Set to true in production deployments
  maxConcurrentOutbound: 5,
};
