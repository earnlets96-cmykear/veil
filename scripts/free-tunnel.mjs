/**
 * VEIL Instant Free Public Deployment Utility.
 *
 * Exposes the local VEIL Relay & Cloud Backend over a free, public, secure HTTPS/WSS URL
 * with zero configuration, zero cost, and zero account requirements.
 *
 * Usage:
 *   node scripts/free-tunnel.mjs
 */

import { spawn } from 'child_process';
import * as http from 'http';

const LOCAL_PORT = 8787;

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureLocalServer() {
  const isOpen = await isPortOpen(LOCAL_PORT);
  if (!isOpen) {
    console.log(`🚀 Starting local VEIL Relay Server on port ${LOCAL_PORT}...`);
    const serverProc = spawn('npx', ['-y', 'tsx', 'src/server/cli.ts'], {
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    // Wait for server to start
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isPortOpen(LOCAL_PORT)) {
        console.log(`✅ Local VEIL Relay Server is ready.`);
        return;
      }
    }
  } else {
    console.log(`✅ Local VEIL Relay Server is already running on port ${LOCAL_PORT}.`);
  }
}

async function startTunnel() {
  await ensureLocalServer();

  console.log(`🌐 Initializing free public tunnel...`);

  const tunnelProc = spawn('npx', ['-y', 'localtunnel', '--port', String(LOCAL_PORT)], {
    shell: true,
  });

  tunnelProc.stdout.on('data', (data) => {
    const str = data.toString();
    const match = str.match(/your url is: (https:\/\/[^\s]+)/i);
    if (match) {
      const publicHttpsUrl = match[1].trim();
      const publicWssUrl = publicHttpsUrl.replace(/^https:/i, 'wss:') + '/v1/ws';

      console.log('\n' + '='.repeat(70));
      console.log('🎉 VEIL IS NOW LIVE & PUBLICLY ACCESSIBLE ACROSS THE INTERNET (100% FREE)!');
      console.log('='.repeat(70));
      console.log(`\n📌 Public HTTPS Endpoint:  ${publicHttpsUrl}`);
      console.log(`📌 Public WSS Stream:      ${publicWssUrl}`);
      console.log(`📌 Health Check:          ${publicHttpsUrl}/healthz`);
      console.log(`📌 Readiness Check:       ${publicHttpsUrl}/readyz`);
      console.log('\n📲 TO CONNECT FROM EXTERNAL BROWSERS OR PHONES:');
      console.log(`👉 Open: http://localhost:5173/?relay=${encodeURIComponent(publicHttpsUrl)}`);
      console.log(`👉 Or deployed web app with: ?relay=${encodeURIComponent(publicHttpsUrl)}`);
      console.log('='.repeat(70) + '\n');
    } else {
      console.log(str.trim());
    }
  });

  tunnelProc.stderr.on('data', (data) => {
    const err = data.toString().trim();
    if (err) console.error(`[Tunnel Error]: ${err}`);
  });

  tunnelProc.on('close', (code) => {
    console.log(`Tunnel closed with code ${code}`);
  });
}

startTunnel().catch(console.error);
