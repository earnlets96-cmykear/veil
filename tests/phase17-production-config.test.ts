import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../src/config/appConfig.ts';
import { AppConfig } from '../src/config/types.ts';

describe('VEIL Phase 17: Production Environment Configuration Tests', () => {
  it('PRODUCTION TLS ENFORCEMENT: Rejects unencrypted http/ws URLs in production mode', () => {
    const invalidHttpConfig: AppConfig = {
      ...ConfigManager.getConfig('production'),
      relayHttpUrl: 'http://insecure-relay.example.com',
      enforceTls: true,
    };

    expect(() => {
      ConfigManager.validateConfig(invalidHttpConfig);
    }).toThrow(/Production config violation: HTTP URL must use HTTPS/);

    const invalidWsConfig: AppConfig = {
      ...ConfigManager.getConfig('production'),
      relayWsUrl: 'ws://insecure-relay.example.com/v1/ws',
      enforceTls: true,
    };

    expect(() => {
      ConfigManager.validateConfig(invalidWsConfig);
    }).toThrow(/Production config violation: WS URL must use WSS/);
  });

  it('DEVELOPMENT & TEST FLEXIBILITY: Allows localhost plain http/ws in development and test environments', () => {
    const devCfg = ConfigManager.getConfig('development');
    expect(devCfg.env).toBe('development');
    expect(() => ConfigManager.validateConfig(devCfg)).not.toThrow();

    const testCfg = ConfigManager.getConfig('test');
    expect(testCfg.env).toBe('test');
    expect(() => ConfigManager.validateConfig(testCfg)).not.toThrow();
  });

  it('FAIL-CLOSED VALIDATION: Catches invalid bounds with actionable diagnostics without leaking sensitive data', () => {
    const invalidQueueConfig: AppConfig = {
      ...ConfigManager.getConfig('production'),
      maxOutboundQueueSize: -5,
    };

    expect(() => {
      ConfigManager.validateConfig(invalidQueueConfig);
    }).toThrow(/Invalid config: maxOutboundQueueSize/);
  });
});
