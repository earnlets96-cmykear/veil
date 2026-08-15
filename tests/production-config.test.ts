import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../src/config/appConfig.ts';

describe('VEIL Phase 15: Production Configuration Tests', () => {
  it('CONFIG ENVIRONMENTS: Returns appropriate config for dev, test, and production', () => {
    const dev = ConfigManager.getConfig('development');
    expect(dev.env).toBe('development');
    expect(dev.enforceTls).toBe(false);

    const test = ConfigManager.getConfig('test');
    expect(test.env).toBe('test');
    expect(test.logLevel).toBe('none');

    const prod = ConfigManager.getConfig('production');
    expect(prod.env).toBe('production');
    expect(prod.enforceTls).toBe(true);
    expect(prod.relayHttpUrl).toMatch(/^https:\/\//);
    expect(prod.relayWsUrl).toMatch(/^wss:\/\//);
  });

  it('CONFIG VALIDATION: Rejects non-TLS URLs in production when enforceTls is true', () => {
    const invalidProdConfig = {
      env: 'production' as const,
      relayHttpUrl: 'http://insecure-relay.com',
      relayWsUrl: 'ws://insecure-relay.com/ws',
      enforceTls: true,
      requestTimeoutMs: 15000,
      maxOutboundQueueSize: 1000,
      maxAttachmentSizeBytes: 25 * 1024 * 1024,
      defaultNotificationMode: 'SENDER_ONLY' as const,
      logLevel: 'error' as const,
    };

    expect(() => {
      ConfigManager.validateConfig(invalidProdConfig);
    }).toThrow(/Production config violation: HTTP URL must use HTTPS/);
  });
});
