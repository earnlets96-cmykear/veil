import { describe, it, expect } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';

describe('VEIL Phase 12: Relay Server Graceful Shutdown Tests', () => {
  it('GRACEFUL SHUTDOWN: Stops server cleanly and releases network sockets', async () => {
    const server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Verify it is reachable
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);

    // Stop server
    await server.stop();

    // Verify connections are refused
    await expect(fetch(`${baseUrl}/healthz`)).rejects.toThrow();
  });
});
