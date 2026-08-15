/**
 * VEIL Transport Layer Type Definitions.
 * Defines the blind mailbox model, transport envelopes, size classes, and capabilities.
 */

/**
 * Standard fixed size classes for traffic analysis mitigation.
 * All payloads are padded to the smallest fitting size class.
 */
export type SizeClass = 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE';

export const SIZE_CLASS_BYTES: Record<SizeClass, number> = {
  SMALL: 512,       // 512 bytes
  MEDIUM: 2048,     // 2 KiB
  LARGE: 8192,      // 8 KiB
  XLARGE: 32768,    // 32 KiB
};

export const MAX_PAYLOAD_BYTES = SIZE_CLASS_BYTES.XLARGE - 4; // Reserve 4 bytes for length prefix

/**
 * Transport Envelope: Opaque encrypted blob delivered via the untrusted server.
 * The server sees ONLY this metadata and treats payload as opaque bytes.
 */
export interface TransportEnvelope {
  version: 1;
  envelopeId: string;        // Cryptographically random unique identifier for replay protection
  mailboxId: string;         // Opaque target mailbox identifier
  payload: string;           // Base64-encoded padded and encrypted payload
  sizeClass: SizeClass;      // Declared size class
  createdAt: number;         // Unix timestamp (ms)
  expiresAt: number;         // TTL expiration Unix timestamp (ms)
}

/**
 * Client-held mailbox authorization secret.
 */
export interface MailboxCapability {
  mailboxId: string;         // Opaque mailbox identifier (hex)
  capability: string;        // 32-byte secret authorization token (Base64)
}

/**
 * Server-side storage record for a blind mailbox.
 * Contains ONLY the verifier (hash of capability), never the raw secret.
 */
export interface ServerMailboxRecord {
  mailboxId: string;
  verifier: string;          // Base64 SHA-256 verifier of capability
  createdAt: number;
  envelopes: Map<string, TransportEnvelope>; // envelopeId -> TransportEnvelope
}

/**
 * Outbox status for local message queueing.
 */
export type OutboxMessageStatus = 'pending' | 'sending' | 'acknowledged' | 'failed';

export interface OutboxItem {
  id: string;
  envelope: TransportEnvelope;
  recipientMailboxId: string;
  status: OutboxMessageStatus;
  attempts: number;
  lastAttemptAt?: number;
  createdAt: number;
  error?: string;
}

/**
 * Inbox item for received and deduplicated envelopes.
 */
export interface InboxItem {
  envelopeId: string;
  mailboxId: string;
  payload: string;           // Base64 encoded payload
  sizeClass: SizeClass;
  receivedAt: number;
  createdAt: number;
  expiresAt: number;
}

/**
 * Status response for mailbox queries.
 */
export interface MailboxStatus {
  mailboxId: string;
  envelopeCount: number;
  oldestCreatedAt?: number;
  newestCreatedAt?: number;
}

/**
 * Transport Network Adapter Interface.
 * Pluggable transport substrate (mock, HTTP, WebSocket, future relay).
 */
export interface ITransportAdapter {
  createMailbox(mailboxId: string, verifier: string): Promise<boolean>;
  postEnvelope(envelope: TransportEnvelope): Promise<boolean>;
  fetchEnvelopes(mailboxId: string, capability: string, limit?: number): Promise<TransportEnvelope[]>;
  acknowledgeEnvelope(mailboxId: string, capability: string, envelopeId: string): Promise<boolean>;
  deleteMailbox(mailboxId: string, capability: string): Promise<boolean>;
  getMailboxStatus(mailboxId: string, capability: string): Promise<MailboxStatus | null>;
}
