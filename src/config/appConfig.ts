/**
 * Production Configuration Management for VEIL.
 *
 * Provides typed, validated environment configurations without baking
 * secrets into client bundles.
 */

import { AppConfig, AppEnvironment } from './types.ts';

const DEV_CONFIG: AppConfig = {
  env: 'development',
  relayHttpUrl: 'http://127.0.0.1:8787',
  relayWsUrl: 'ws://127.0.0.1:8787/v1/ws',
  enforceTls: false,
  requestTimeoutMs: 10000,
  maxOutboundQueueSize: 500,
  maxAttachmentSizeBytes: 10 * 1024 * 1024, // 10 MiB
  defaultNotificationMode: 'SENDER_ONLY',
  logLevel: 'info',
};

const TEST_CONFIG: AppConfig = {
  env: 'test',
  relayHttpUrl: 'http://127.0.0.1:0',
  relayWsUrl: 'ws://127.0.0.1:0/v1/ws',
  enforceTls: false,
  requestTimeoutMs: 5000,
  maxOutboundQueueSize: 100,
  maxAttachmentSizeBytes: 1 * 1024 * 1024, // 1 MiB
  defaultNotificationMode: 'HIDDEN',
  logLevel: 'none',
};

const PROD_CONFIG: AppConfig = {
  env: 'production',
  relayHttpUrl: 'https://relay.veil.chat',
  relayWsUrl: 'wss://relay.veil.chat/v1/ws',
  enforceTls: true,
  requestTimeoutMs: 15000,
  maxOutboundQueueSize: 1000,
  maxAttachmentSizeBytes: 25 * 1024 * 1024, // 25 MiB
  defaultNotificationMode: 'SENDER_ONLY',
  logLevel: 'error',
};

export class ConfigManager {
  public static getConfig(env?: AppEnvironment): AppConfig {
    const currentEnv = env || (process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'test' ? 'test' : 'development');

    switch (currentEnv) {
      case 'production':
        return { ...PROD_CONFIG };
      case 'test':
        return { ...TEST_CONFIG };
      case 'development':
      default:
        return { ...DEV_CONFIG };
    }
  }

  public static validateConfig(config: AppConfig): void {
    if (config.enforceTls) {
      if (!config.relayHttpUrl.startsWith('https://')) {
        throw new Error(`Production config violation: HTTP URL must use HTTPS when enforceTls is true (got: ${config.relayHttpUrl})`);
      }
      if (!config.relayWsUrl.startsWith('wss://')) {
        throw new Error(`Production config violation: WS URL must use WSS when enforceTls is true (got: ${config.relayWsUrl})`);
      }
    }

    if (config.maxOutboundQueueSize <= 0) {
      throw new Error('Invalid config: maxOutboundQueueSize must be > 0');
    }

    if (config.requestTimeoutMs < 1000) {
      throw new Error('Invalid config: requestTimeoutMs must be >= 1000ms');
    }
  }
}
