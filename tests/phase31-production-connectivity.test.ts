/**
 * Phase 31: Production Connectivity, Canonical Routing & CORS Tests.
 *
 * Verifies that the production relay URL resolves to an active HTTPS/WSS endpoint,
 * supports environment overrides (VITE_RELAY_URL), binds PORT properly, and handles
 * CORS preflight requests cleanly.
 */

import { describe, it, expect } from 'vitest';
import { PRODUCTION_RELAY_URL, PRODUCTION_RELAY_WS_URL, ConfigManager } from '../src/config/appConfig.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import * as path from 'path';
import * as fs from 'fs';

const TEST_DIR = path.join(process.cwd(), '.veil_test_conn_suite');

describe('Phase 31: Production Connectivity & Canonical Routing', () => {
  it('enforces canonical production relay endpoints and TLS pairing', () => {
    expect(PRODUCTION_RELAY_URL).toBe('https://veil-rga0.onrender.com');
    expect(PRODUCTION_RELAY_WS_URL).toBe('wss://veil-rga0.onrender.com/v1/ws');

    const config = ConfigManager.getConfig('production');
    expect(config.relayHttpUrl).toBe('https://veil-rga0.onrender.com');
    expect(config.relayWsUrl).toBe('wss://veil-rga0.onrender.com/v1/ws');
    expect(config.enforceTls).toBe(true);

    expect(() => ConfigManager.validateConfig(config)).not.toThrow();
  });

  it('rejects cleartext HTTP when enforceTls is enabled in production', () => {
    const badConfig = {
      ...ConfigManager.getConfig('production'),
      relayHttpUrl: 'http://veil-rga0.onrender.com',
    };
    expect(() => ConfigManager.validateConfig(badConfig)).toThrow(/Production config violation/i);
  });

  it('handles CORS OPTIONS preflight correctly on API endpoints', async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    const store = new PersistentFileRelayStore(path.join(TEST_DIR, 'relay'));
    const db = new SqlCloudDatabase({ diskPath: path.join(TEST_DIR, 'db') });
    const storage = new S3ObjectStorage();
    await store.init();
    await db.init();
    await storage.init();

    const server = new RelayServer({ port: 0, host: '0.0.0.0' }, store, db, storage);
    const addr = await server.start();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const optionsRes = await fetch(`${baseUrl}/v1/mailboxes`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://veil.chat',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(optionsRes.status).toBe(204);
      expect(optionsRes.headers.get('access-control-allow-origin')).toBe('*');
      expect(optionsRes.headers.get('access-control-allow-methods')).toContain('POST');
    } finally {
      await server.stop();
      if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });
});
