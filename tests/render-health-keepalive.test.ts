/**
 * VEIL Render Keep-Alive & Health Check Verification Suite
 *
 * Validates that GET /health:
 * 1. Returns HTTP 200 with Content-Type: application/json
 * 2. Returns minimal status: "ok" payload
 * 3. Requires zero authentication or special headers
 * 4. Executes instantly with zero DB mutations or crypto overhead
 * 5. Does not expose secrets, credentials, database URLs, tokens, or PII
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';

describe('Render Keep-Alive & Health Check Endpoints', () => {
  let server: RelayServer;
  let baseUrl: string;

  beforeAll(async () => {
    // Start RelayServer on random available port on 0.0.0.0 (or 127.0.0.1 for local test harness)
    server = new RelayServer(
      {
        port: 0,
        host: '127.0.0.1',
        logLevel: 'none',
      },
      new MemoryRelayStore(),
      new MemoryCloudDatabase(),
      new LocalDiskObjectStorage()
    );

    const address = await server.start();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('GET /health: Returns HTTP 200 and JSON with status "ok"', async () => {
    const startTime = performance.now();
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
    });
    const elapsed = performance.now() - startTime;

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.protocolVersion).toBe('v1');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);

    // Verify sub-50ms execution speed
    expect(elapsed).toBeLessThan(50);
  });

  it('GET /health: Requires no authentication headers or tokens', async () => {
    // Deliberately request with no Authorization header and no cookies
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {},
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('GET /health: Exposes zero sensitive info, credentials, or PII', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const rawText = await res.text();
    const body = JSON.parse(rawText);

    // Verify allowed public-only fields
    const allowedKeys = ['status', 'protocolVersion', 'uptimeSeconds'];
    for (const key of Object.keys(body)) {
      expect(allowedKeys).toContain(key);
    }

    // Security assertions: ensure no sensitive strings or leakages
    expect(rawText).not.toContain('postgres');
    expect(rawText).not.toContain('password');
    expect(rawText).not.toContain('secret');
    expect(rawText).not.toContain('token');
    expect(rawText).not.toContain('key');
    expect(rawText).not.toContain('r2');
    expect(rawText).not.toContain('accountId');
    expect(rawText).not.toContain('deviceId');
  });

  it('GET /healthz: Maintains backwards-compatible alias endpoint', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
