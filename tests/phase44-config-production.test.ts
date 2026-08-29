import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager, PRODUCTION_RELAY_URL, PRODUCTION_RELAY_WS_URL } from '../src/config/appConfig.ts';

describe('Phase 44: Mobile & Production Relay URL Configuration Suite', () => {
  const origWindow = globalThis.window;

  beforeEach(() => {
    // Reset window mock
  });

  afterEach(() => {
    globalThis.window = origWindow;
  });

  it('defaults to PRODUCTION_RELAY_URL on non-test environments or production bundle', () => {
    const prodConfig = ConfigManager.getConfig('production');
    expect(prodConfig.relayHttpUrl).toBe(PRODUCTION_RELAY_URL);
    expect(prodConfig.relayWsUrl).toBe(PRODUCTION_RELAY_WS_URL);
    expect(prodConfig.enforceTls).toBe(true);
    expect(prodConfig.relayHttpUrl.startsWith('https://')).toBe(true);
  });

  it('correctly provides test config for local unit tests', () => {
    const testConfig = ConfigManager.getConfig('test');
    expect(testConfig.env).toBe('test');
    expect(testConfig.relayHttpUrl).toBe('http://127.0.0.1:0');
  });

  it('respects custom relay override via localStorage or URL query parameter', () => {
    (globalThis as any).window = {
      location: {
        search: '?relay=https://custom-relay.example.com',
        origin: 'capacitor://localhost',
        hostname: 'localhost',
      },
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
    };

    const config = ConfigManager.getConfig('production');
    expect(config.relayHttpUrl).toBe('https://custom-relay.example.com');
    expect(config.relayWsUrl).toBe('wss://custom-relay.example.com/v1/ws');
  });
});
