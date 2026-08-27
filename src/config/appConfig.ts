/**
 * Production Configuration Management for VEIL.
 *
 * Provides typed, validated environment configurations without baking
 * secrets into client bundles.
 */

import { AppConfig, AppEnvironment } from './types.ts';

export const PRODUCTION_RELAY_URL = 'https://relay.veil.chat';
export const PRODUCTION_RELAY_WS_URL = 'wss://relay.veil.chat/v1/ws';

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
  relayHttpUrl: PRODUCTION_RELAY_URL,
  relayWsUrl: PRODUCTION_RELAY_WS_URL,
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

    let base: AppConfig;
    switch (currentEnv) {
      case 'production':
        base = { ...PROD_CONFIG };
        break;
      case 'test':
        base = { ...TEST_CONFIG };
        break;
      case 'development':
      default:
        base = { ...DEV_CONFIG };
        break;
    }

    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const queryRelay = urlParams.get('relay');
        const storedRelay = window.localStorage.getItem('veil_custom_relay_url');
        const origin = window.location.origin;
        const autoOrigin = origin && !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.startsWith('file:') ? origin : null;
        const customUrl = queryRelay || storedRelay || autoOrigin;
        if (customUrl) {
          if (queryRelay) {
            window.localStorage.setItem('veil_custom_relay_url', queryRelay);
          }
          const cleanHttp = customUrl.replace(/\/+$/, '');
          const cleanWs = cleanHttp.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:') + '/v1/ws';
          base.relayHttpUrl = cleanHttp;
          base.relayWsUrl = cleanWs;
          if (cleanHttp.startsWith('https://')) {
            base.enforceTls = true;
          }
        }
      } catch (_e) {
        // ignore in non-browser/restricted context
      }
    }

    return base;
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
