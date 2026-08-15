import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';

describe('VEIL Phase 12: Relay Capability Authorization & Mailbox Isolation Tests', () => {
  let server: RelayServer;
  let baseUrl: string;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('CAPABILITY STORAGE: Server stores only one-way SHA-256 hash of capability token', async () => {
    const res = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mb = await res.json();

    // Inspect server store directly
    const storedRecord = await server.getStore().getMailbox(mb.mailboxId);
    expect(storedRecord).not.toBeNull();
    expect(storedRecord!.capabilityHash).toHaveLength(64);
    // Plaintext token must NOT equal the stored hash
    expect(storedRecord!.capabilityHash).not.toBe(mb.capabilityToken);
  });

  it('CAPABILITY VERIFICATION: Rejects fetch with invalid or tampered capability token', async () => {
    const res = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mb = await res.json();

    // Try fetching with forged token
    const fetchRes = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mb.mailboxId,
        capabilityToken: '0000000000000000000000000000000000000000000000000000000000000000',
      }),
    });

    expect(fetchRes.status).toBe(401);
    const err = await fetchRes.json();
    expect(err.error.code).toBe('UNAUTHORIZED');
  });

  it('CROSS-MAILBOX ISOLATION: Mailbox A capability cannot fetch Mailbox B envelopes', async () => {
    // Create Mailbox A and Mailbox B
    const mbARes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mbA = await mbARes.json();

    const mbBRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mbB = await mbBRes.json();

    // Send envelope to Mailbox B
    await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mbB.mailboxId,
        payload: Buffer.from('Confidential payload for B').toString('base64'),
      }),
    });

    // Attempt to fetch Mailbox B using Mailbox A's capability
    const attackFetch = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mbB.mailboxId,
        capabilityToken: mbA.capabilityToken,
      }),
    });

    expect(attackFetch.status).toBe(401);
    const err = await attackFetch.json();
    expect(err.error.code).toBe('UNAUTHORIZED');
  });

  it('CROSS-MAILBOX ISOLATION: Mailbox A capability cannot acknowledge Mailbox B envelopes', async () => {
    const mbARes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mbA = await mbARes.json();

    const mbBRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mbB = await mbBRes.json();

    // Send envelope to B
    const envRes = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mbB.mailboxId,
        payload: Buffer.from('Payload').toString('base64'),
      }),
    });
    const env = await envRes.json();

    // Attempt to ACK B's envelope using A's capability
    const attackAck = await fetch(`${baseUrl}/v1/envelopes/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mbB.mailboxId,
        capabilityToken: mbA.capabilityToken,
        envelopeIds: [env.envelopeId],
      }),
    });

    expect(attackAck.status).toBe(401);

    // Verify envelope still exists in Mailbox B
    const verifyFetch = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mbB.mailboxId,
        capabilityToken: mbB.capabilityToken,
      }),
    });
    const body = await verifyFetch.json();
    expect(body.envelopes).toHaveLength(1);
  });
});
