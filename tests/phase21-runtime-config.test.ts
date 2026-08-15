import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../src/config/index.ts';

describe('VEIL Phase 21: Runtime Configuration & Sanitizer Tests', () => {
  it('PRODUCTION CONFIGURATION: Rejects insecure endpoints in production mode', () => {
    const prodConfig = ConfigManager.getConfig('production');
    expect(prodConfig.enforceTls).toBe(true);

    // In production, HTTP and WS URLs must be rejected if TLS is required
    const insecureConfig = {
      ...prodConfig,
      relayHttpUrl: 'http://insecure-relay.example.com',
    };

    expect(() => ConfigManager.validateConfig(insecureConfig)).toThrow();
  });
});
