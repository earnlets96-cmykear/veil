/**
 * VEIL Standalone Relay Server CLI Entrypoint.
 *
 * Starts the relay server with configurable port, host, storage directory, and TLS.
 */

import { RelayServer } from './relayServer.ts';
import { PersistentFileRelayStore } from './storage/persistentRelayStore.ts';
import * as path from 'path';

const port = parseInt(process.env.RELAY_PORT || process.env.PORT || '8787', 10);
const host = process.env.RELAY_HOST || '0.0.0.0';
const storageDir = process.env.RELAY_STORAGE_DIR || path.join(process.cwd(), '.veil_relay_data');

async function main() {
  console.log('🛡️ Starting VEIL Blind Relay Server...');
  console.log(`📦 Storage Directory: ${storageDir}`);

  const store = new PersistentFileRelayStore(storageDir);
  await store.init();

  const server = new RelayServer(
    {
      port,
      host,
      logLevel: 'info',
    },
    store
  );

  const address = await server.start();
  console.log(`🚀 VEIL Relay Server listening on http://${address.host}:${address.port}`);
  console.log(`⚡ WebSocket endpoint: ws://${address.host}:${address.port}/v1/ws`);

  const shutdown = async () => {
    console.log('\n🛑 Shutting down VEIL Relay Server...');
    await server.stop();
    await store.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error starting VEIL Relay Server:', err);
  process.exit(1);
});
