/**
 * VEIL Live Relay Health & Diagnostics Script.
 *
 * Verifies live HTTP/HTTPS readiness and WebSocket connectivity against target relay.
 * Usage: node scripts/live-health-check.mjs [relay_url]
 */

import http from 'http';
import https from 'https';
import { WebSocket } from 'ws';

const relayUrl = process.argv[2] || process.env.VEIL_RELAY_URL || 'http://127.0.0.1:8787';

console.log(`🔍 Checking VEIL Relay Health at: ${relayUrl}`);

const client = relayUrl.startsWith('https') ? https : http;

// 1. Health Endpoint Check
client.get(`${relayUrl}/health`, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(`✅ HTTP Health Check Passed: Status=${res.statusCode}, Status=${parsed.status}, Version=${parsed.version}`);
    } catch (e) {
      console.log(`⚠️ HTTP Health Check Non-JSON response: Status=${res.statusCode}`);
    }

    // 2. WebSocket Connectivity Check
    const wsUrl = relayUrl.replace(/^http/, 'ws') + '/v1/ws';
    console.log(`🔌 Probing WebSocket connection at: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('✅ WebSocket Connected Successfully');
      ws.close();
      process.exit(0);
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket Connection Error:', err.message);
      process.exit(1);
    });
  });
}).on('error', (err) => {
  console.error('❌ HTTP Health Check Error:', err.message);
  process.exit(1);
});
