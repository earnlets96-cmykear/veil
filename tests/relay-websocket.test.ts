import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { RelayServer } from '../src/server/relayServer.ts';

describe('VEIL Phase 12: Relay WebSocket Real-Time Channel Tests', () => {
  let server: RelayServer;
  let wsUrl: string;
  let httpUrl: string;

  beforeEach(async () => {
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();
    wsUrl = `ws://127.0.0.1:${port}/v1/ws`;
    httpUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('WEBSOCKET REAL-TIME DELIVERY: Authenticates socket and receives instant envelope push', async () => {
    // 1. Create mailbox via HTTP
    const mbRes = await fetch(`${httpUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mb = await mbRes.json();

    // 2. Connect WebSocket
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));

    // 3. Authenticate socket
    ws.send(JSON.stringify({
      type: 'auth',
      mailboxId: mb.mailboxId,
      capabilityToken: mb.capabilityToken,
    }));

    const authReply = await new Promise<any>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    expect(authReply.type).toBe('authenticated');
    expect(authReply.mailboxId).toBe(mb.mailboxId);

    // 4. Send ping -> verify pong
    ws.send(JSON.stringify({ type: 'ping' }));
    const pongReply = await new Promise<any>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    expect(pongReply.type).toBe('pong');

    // 5. Post envelope via HTTP while WebSocket is listening
    const payloadText = 'Real-time WebSocket Push Test Payload';
    const testPayload = Buffer.from(payloadText).toString('base64');

    const envelopePromise = new Promise<any>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });

    await fetch(`${httpUrl}/v1/envelopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mb.mailboxId,
        payload: testPayload,
      }),
    });

    const pushedMsg = await envelopePromise;
    expect(pushedMsg.type).toBe('envelope');
    expect(pushedMsg.envelope.payload).toBe(testPayload);
    expect(pushedMsg.envelope.mailboxId).toBe(mb.mailboxId);

    // 6. ACK over WebSocket
    ws.send(JSON.stringify({
      type: 'ack',
      envelopeIds: [pushedMsg.envelope.envelopeId],
    }));

    const ackReply = await new Promise<any>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    expect(ackReply.type).toBe('ack_confirm');
    expect(ackReply.acknowledgedCount).toBe(1);

    ws.close();
  });
});
