/**
 * VEIL Relay Server Configuration.
 *
 * Centralizes all network limits, TTLs, and operational thresholds.
 */

export interface RelayServerConfig {
  port: number;
  host: string;
  maxEnvelopeSizeBytes: number;
  maxMailboxEnvelopes: number;
  maxEnvelopesPerFetch: number;
  defaultEnvelopeTtlMs: number;
  maxEnvelopeTtlMs: number;
  defaultMailboxTtlMs: number;
  maxMailboxTtlMs: number;
  cleanupIntervalMs: number;
  rateLimitWindowMs: number;
  maxRequestsPerWindow: number;
  maxWsConnectionsPerIp: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'none';
}

export const DEFAULT_RELAY_CONFIG: RelayServerConfig = {
  port: Number(process?.env?.PORT || 8080),
  host: process?.env?.HOST || '127.0.0.1',
  maxEnvelopeSizeBytes: 65536, // 64 KiB
  maxMailboxEnvelopes: 1000,
  maxEnvelopesPerFetch: 50,
  defaultEnvelopeTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxEnvelopeTtlMs: 14 * 24 * 60 * 60 * 1000,     // 14 days
  defaultMailboxTtlMs: 30 * 24 * 60 * 60 * 1000,  // 30 days
  maxMailboxTtlMs: 90 * 24 * 60 * 60 * 1000,      // 90 days
  cleanupIntervalMs: 60 * 1000,                   // 60 seconds
  rateLimitWindowMs: 60 * 1000,                   // 1 minute
  maxRequestsPerWindow: 120,                      // 120 requests/minute/IP
  maxWsConnectionsPerIp: 20,
  logLevel: (process?.env?.LOG_LEVEL as any) || 'info',
};
