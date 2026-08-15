import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';

describe('VEIL Phase 12: Relay Adversarial & Abuse Defense Tests', () => {
  let server: RelayServer;
  let baseUrl: string;

  beforeEach(async () => {
    server = new RelayServer({
      port: 0,
      host: '127.0.0.1',
      logLevel: 'none',
      maxEnvelopeSizeBytes: 65536, // 64 KiB limit
      maxRequestsPerWindow: 10,     // strict rate limit for test
      rateLimitWindowMs: 60000,
    });
    const { port } = await server.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('OVERSIZED PAYLOAD REJECTION: Rejects envelopes exceeding 64 KiB', async () => {
    const mbRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mb = await mbRes.json();

    // Generate 70 KiB payload
    const hugePayload = 'A'.repeat(70 * 1024);

    const res = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mb.mailboxId,
        payload: hugePayload,
      }),
    });

    expect(res.status).toBe(413);
    const err = await res.json();
    expect(err.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('MALFORMED JSON REJECTION: Handles invalid JSON syntax safely without crash', async () => {
    const res = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid_json: ',
    });

    expect(res.status).toBe(400);
    const err = await res.json();
    expect(err.error.code).toBe('BAD_REQUEST');
  });

  it('TARGET NOT FOUND: Rejects envelope submission to non-existent mailbox', async () => {
    const res = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        payload: Buffer.from('Payload').toString('base64'),
      }),
    });

    expect(res.status).toBe(404);
    const err = await res.json();
    expect(err.error.code).toBe('NOT_FOUND');
  });

  it('RATE LIMITING: Enforces request throttling after limit is reached', async () => {
    // Fire requests up to the limit (10)
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(200);
    }

    // 11th request must be throttled
    const throttledRes = await fetch(`${baseUrl}/healthz`);
    expect(throttledRes.status).toBe(429);
    const err = await throttledRes.json();
    expect(err.error.code).toBe('RATE_LIMITED');
  });
});
