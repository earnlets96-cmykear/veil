import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { HttpTransport } from '../src/network/httpTransport.ts';
import { DEFAULT_NETWORK_CONFIG } from '../src/network/types.ts';

describe('VEIL Phase 13: Client HttpTransport & Relay Integration Tests', () => {
  let server: RelayServer;
  let http: HttpTransport;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();
    http = new HttpTransport({
      ...DEFAULT_NETWORK_CONFIG,
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('HEALTH CHECK: Verifies relay server health and protocol v1 negotiation', async () => {
    const health = await http.checkHealth();
    expect(health.status).toBe('ok');
    expect(health.protocolVersion).toBe('v1');
  });

  it('MAILBOX LIFECYCLE: Creates mailbox, sends envelope, fetches, and ACKs via HttpTransport', async () => {
    // 1. Create mailbox
    const mb = await http.createMailbox(3600);
    expect(mb.mailboxId).toHaveLength(64);
    expect(mb.capabilityToken).toHaveLength(64);

    // 2. Send envelope
    const payload = Buffer.from('Encrypted Payload Data').toString('base64');
    const sent = await http.sendEnvelope(mb.mailboxId, payload);
    expect(sent.envelopeId).toBeTruthy();

    // 3. Fetch envelope
    const fetched = await http.fetchEnvelopes(mb.mailboxId, mb.capabilityToken);
    expect(fetched.envelopes).toHaveLength(1);
    expect(fetched.envelopes[0].payload).toBe(payload);

    // 4. ACK envelope
    const ack = await http.ackEnvelopes(mb.mailboxId, mb.capabilityToken, [sent.envelopeId]);
    expect(ack.acknowledgedCount).toBe(1);

    // 5. Fetch again -> empty
    const fetchedAfter = await http.fetchEnvelopes(mb.mailboxId, mb.capabilityToken);
    expect(fetchedAfter.envelopes).toHaveLength(0);
  });
});
