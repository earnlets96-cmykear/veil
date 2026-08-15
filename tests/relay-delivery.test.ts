import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';

describe('VEIL Phase 12: Relay Delivery Semantics, ACK & TTL Tests', () => {
  let server: RelayServer;
  let baseUrl: string;

  beforeEach(async () => {
    server = new RelayServer({
      port: 0,
      host: '127.0.0.1',
      logLevel: 'none',
      maxMailboxEnvelopes: 3,
    });
    const { port } = await server.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('AT-LEAST-ONCE DELIVERY: Envelopes remain available until explicitly acknowledged', async () => {
    // 1. Create mailbox
    const mbRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mb = await mbRes.json();

    // 2. Post two envelopes
    const p1 = Buffer.from('Message 1').toString('base64');
    const p2 = Buffer.from('Message 2').toString('base64');

    const env1Res = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: mb.mailboxId, payload: p1 }),
    });
    const env1 = await env1Res.json();

    const env2Res = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: mb.mailboxId, payload: p2 }),
    });
    const env2 = await env2Res.json();

    // 3. First fetch -> returns both
    const fetch1 = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: mb.mailboxId, capabilityToken: mb.capabilityToken }),
    });
    const data1 = await fetch1.json();
    expect(data1.envelopes).toHaveLength(2);

    // 4. Repeated fetch without ACK -> STILL returns both (at-least-once delivery guarantee)
    const fetch2 = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: mb.mailboxId, capabilityToken: mb.capabilityToken }),
    });
    const data2 = await fetch2.json();
    expect(data2.envelopes).toHaveLength(2);

    // 5. ACK only Envelope 1
    const ackRes = await fetch(`${baseUrl}/v1/envelopes/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mb.mailboxId,
        capabilityToken: mb.capabilityToken,
        envelopeIds: [env1.envelopeId],
      }),
    });
    const ackData = await ackRes.json();
    expect(ackData.acknowledgedCount).toBe(1);

    // 6. Third fetch -> returns only Envelope 2
    const fetch3 = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: mb.mailboxId, capabilityToken: mb.capabilityToken }),
    });
    const data3 = await fetch3.json();
    expect(data3.envelopes).toHaveLength(1);
    expect(data3.envelopes[0].envelopeId).toBe(env2.envelopeId);
  });

  it('QUEUE LIMIT: Rejects new envelopes when mailbox exceeds capacity', async () => {
    const mbRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mb = await mbRes.json();

    // Fill queue to capacity (max 3)
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/v1/envelopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId: mb.mailboxId,
          payload: Buffer.from(`Payload ${i}`).toString('base64'),
        }),
      });
      expect(res.status).toBe(201);
    }

    // 4th submission must be rejected
    const overflowRes = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mb.mailboxId,
        payload: Buffer.from('Overflow payload').toString('base64'),
      }),
    });

    expect(overflowRes.status).toBe(403);
    const err = await overflowRes.json();
    expect(err.error.code).toBe('FORBIDDEN');
  });
});
