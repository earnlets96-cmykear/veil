import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';

describe('VEIL Phase 12: Relay Protocol v1 HTTP Endpoints Tests', () => {
  let server: RelayServer;
  let baseUrl: string;

  beforeEach(async () => {
    // Start server on dynamic port (0)
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('GET /healthz: Returns operational status and protocol version v1', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.protocolVersion).toBe('v1');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('GET /readyz: Returns readiness status', async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.store).toBe('ok');
  });

  it('POST /v1/mailboxes: Allocates blind mailbox and returns secret capability token', async () => {
    const res = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttlSeconds: 3600 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.protocolVersion).toBe('v1');
    expect(body.mailboxId).toHaveLength(64);
    expect(body.capabilityToken).toHaveLength(64);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('POST /v1/envelopes: Submits opaque envelope to target mailbox', async () => {
    // 1. Create mailbox
    const mbRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mb = await mbRes.json();

    // 2. Submit envelope
    const dummyPayload = Buffer.from('Encrypted Opaque Payload Bytes').toString('base64');
    const envRes = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mb.mailboxId,
        payload: dummyPayload,
        ttlSeconds: 1800,
      }),
    });

    expect(envRes.status).toBe(201);
    const env = await envRes.json();
    expect(env.protocolVersion).toBe('v1');
    expect(env.mailboxId).toBe(mb.mailboxId);
    expect(env.envelopeId).toHaveLength(32);
    expect(env.sizeBytes).toBeGreaterThan(0);
  });

  it('404 NOT FOUND: Returns standard error structure for invalid routes', async () => {
    const res = await fetch(`${baseUrl}/invalid/route`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.status).toBe(404);
  });
});
