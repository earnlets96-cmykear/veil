import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';

describe('VEIL Phase 12: 2-Client End-to-End Relay Transport Integration Test', () => {
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

  it('2-CLIENT TRANSPORT FLOW: Client A sends -> Relay stores -> Client B fetches -> Client B ACKs -> Relay deletes', async () => {
    // 1. Client A allocates Mailbox A
    const mbARes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const clientA_Mailbox = await mbARes.json();

    // 2. Client B allocates Mailbox B
    const mbBRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const clientB_Mailbox = await mbBRes.json();

    // 3. Client A sends an opaque ciphertext envelope to Client B's mailbox
    const clientA_Ciphertext = Buffer.from('XChaCha20-Poly1305 Ciphertext from Alice').toString('base64');

    const sendRes = await fetch(`${baseUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: clientB_Mailbox.mailboxId,
        payload: clientA_Ciphertext,
        ttlSeconds: 3600,
      }),
    });

    expect(sendRes.status).toBe(201);
    const sentEnvelope = await sendRes.json();
    expect(sentEnvelope.mailboxId).toBe(clientB_Mailbox.mailboxId);
    expect(sentEnvelope.envelopeId).toBeTruthy();

    // 4. Client B fetches pending envelopes from Mailbox B using Client B's capability token
    const fetchRes = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: clientB_Mailbox.mailboxId,
        capabilityToken: clientB_Mailbox.capabilityToken,
      }),
    });

    expect(fetchRes.status).toBe(200);
    const fetchBody = await fetchRes.json();
    expect(fetchBody.envelopes).toHaveLength(1);
    const receivedEnv = fetchBody.envelopes[0];

    // 5. Verify payload integrity: exact bytes delivered without mutation
    expect(receivedEnv.envelopeId).toBe(sentEnvelope.envelopeId);
    expect(receivedEnv.payload).toBe(clientA_Ciphertext);

    // 6. Client B ACKs the processed envelope
    const ackRes = await fetch(`${baseUrl}/v1/envelopes/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: clientB_Mailbox.mailboxId,
        capabilityToken: clientB_Mailbox.capabilityToken,
        envelopeIds: [receivedEnv.envelopeId],
      }),
    });

    expect(ackRes.status).toBe(200);
    const ackBody = await ackRes.json();
    expect(ackBody.acknowledgedCount).toBe(1);

    // 7. Client B fetches again -> verify mailbox is now empty
    const fetchAfterAck = await fetch(`${baseUrl}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: clientB_Mailbox.mailboxId,
        capabilityToken: clientB_Mailbox.capabilityToken,
      }),
    });

    const emptyBody = await fetchAfterAck.json();
    expect(emptyBody.envelopes).toHaveLength(0);
  });
});
