import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { DirectoryClient } from '../src/network/directoryClient.ts';

describe('VEIL Phase 23: Anti-Enumeration & Directory Abuse Defense Tests', () => {
  let server: RelayServer;
  let relayPort: number;
  let client: DirectoryClient;

  beforeEach(async () => {
    // Start server with strict rate limits for testing
    server = new RelayServer({
      port: 0,
      host: '127.0.0.1',
      logLevel: 'none',
      rateLimitWindowMs: 1000,
      maxRequestsPerWindow: 20,
    });
    const res = await server.start();
    relayPort = res.port;
    client = new DirectoryClient(`http://127.0.0.1:${relayPort}`);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('rejects short search queries (< 3 chars) to prevent full directory dumps', async () => {
    const singleChar = await client.searchProfiles('a');
    expect(singleChar).toHaveLength(0);

    const twoChars = await client.searchProfiles('ab');
    expect(twoChars).toHaveLength(0);

    const empty = await client.searchProfiles('');
    expect(empty).toHaveLength(0);
  });

  it('enforces request rate limiting against bulk automated harvesting', async () => {
    let rateLimited = false;

    for (let i = 0; i < 35; i++) {
      try {
        await client.searchProfiles(`test_query_${i}`);
      } catch (err: any) {
        if (err.message.includes('429') || err.message.includes('RATE_LIMITED') || err.message.includes('Too many requests')) {
          rateLimited = true;
          break;
        }
      }
    }

    expect(rateLimited).toBe(true);
  });
});
