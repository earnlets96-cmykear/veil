/**
 * VEIL Phase 21 Live Relay Connectivity & Diagnostic Tool.
 *
 * Probes target live relay endpoint: checks HTTPS health, readiness, mailbox creation,
 * envelope posting, retrieval, and ACK purge.
 *
 * Usage: node scripts/phase21-live-relay-check.mjs [relay_url]
 */

import http from 'http';
import https from 'https';

const relayUrl = process.argv[2] || process.env.VEIL_LIVE_RELAY_URL || 'http://127.0.0.1:8787';

console.log(`🌐 Probing VEIL Live Relay at: ${relayUrl}`);

const client = relayUrl.startsWith('https') ? https : http;

function makeRequest(urlPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, relayUrl);
    const reqHeaders = { ...headers };
    if (body) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const req = client.request(u, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runRelayDiagnostics() {
  try {
    // 1. Health Check
    const health = await makeRequest('/health');
    console.log(`📡 Health Check: HTTP ${health.statusCode} -> ${health.data}`);

    // 2. Mailbox Allocation Check
    const mbRes = await makeRequest('/v1/mailboxes', 'POST');
    if (mbRes.statusCode !== 201) {
      throw new Error(`Mailbox allocation failed with status ${mbRes.statusCode}`);
    }
    const mb = JSON.parse(mbRes.data);
    console.log(`📬 Mailbox Allocated: ${mb.mailboxId}`);

    // 3. Send Envelope Check
    const sendRes = await makeRequest('/v1/send', 'POST', {
      mailboxId: mb.mailboxId,
      payload: Buffer.from('Live test envelope payload').toString('base64'),
    });
    if (sendRes.statusCode !== 201) {
      throw new Error(`Envelope send failed with status ${sendRes.statusCode}`);
    }
    const sendData = JSON.parse(sendRes.data);
    console.log(`✉️ Envelope Sent: ID=${sendData.envelopeId}`);

    // 4. Fetch Envelopes Check
    const fetchRes = await makeRequest(`/v1/fetch?mailboxId=${mb.mailboxId}`, 'GET', null, {
      Authorization: `Bearer ${mb.capabilityToken}`,
    });
    if (fetchRes.statusCode !== 200) {
      throw new Error(`Envelope fetch failed with status ${fetchRes.statusCode}`);
    }
    const fetchData = JSON.parse(fetchRes.data);
    console.log(`📥 Envelopes Fetched: Count=${fetchData.envelopes?.length}`);

    // 5. ACK Envelope Check
    const ackRes = await makeRequest('/v1/ack', 'POST', {
      mailboxId: mb.mailboxId,
      envelopeIds: [sendData.envelopeId],
    }, {
      Authorization: `Bearer ${mb.capabilityToken}`,
    });
    if (ackRes.statusCode !== 200) {
      throw new Error(`Envelope ACK failed with status ${ackRes.statusCode}`);
    }
    console.log(`🧹 Envelope Acknowledged & Purged successfully.`);

    console.log('✅ All Live Relay Diagnostic Checks Passed!');
  } catch (err) {
    console.error('❌ Live Relay Check Failed:', err.message);
    process.exit(1);
  }
}

runRelayDiagnostics();
