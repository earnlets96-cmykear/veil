/**
 * VEIL Standalone Relay Server CLI Entrypoint.
 *
 * Starts the relay server with configurable port, host, storage directory,
 * durable cloud database (PostgreSQL / File), and S3 object storage.
 */

import { RelayServer } from './relayServer.ts';
import { PersistentFileRelayStore } from './storage/persistentRelayStore.ts';
import { SqlCloudDatabase } from './cloud/database/sqlCloudDatabase.ts';
import { FileCloudDatabase } from './cloud/database/fileCloudDatabase.ts';
import { S3ObjectStorage } from './cloud/storage/s3ObjectStorage.ts';
import { LocalDiskObjectStorage } from './cloud/storage/localDiskObjectStorage.ts';
import type { ICloudDatabase } from './cloud/database/types.ts';
import type { IObjectStorage } from './cloud/storage/types.ts';
import * as path from 'path';

const port = parseInt(process.env.RELAY_PORT || process.env.PORT || '8787', 10);
const host = process.env.RELAY_HOST || '0.0.0.0';
const storageDir = process.env.RELAY_STORAGE_DIR || path.join(process.cwd(), '.veil_relay_data');
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL || '';
const s3Endpoint = process.env.OBJECT_STORAGE_ENDPOINT || process.env.S3_ENDPOINT || '';

async function main() {
  console.log('🛡️ Starting VEIL Blind Relay & Cloud Persistence Server...');
  console.log(`📦 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`📦 Mailbox Store Dir: ${storageDir}`);

  // 1. Initialize Relay Store
  const store = new PersistentFileRelayStore(storageDir);
  await store.init();

  // 2. Initialize Cloud Database
  let cloudDb: ICloudDatabase;
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('file://')) {
    console.log(`🗄️ Database Backend: SQL Database (${databaseUrl.split('@')[1] || databaseUrl.slice(0, 20)}...)`);
    cloudDb = new SqlCloudDatabase(databaseUrl);
  } else if (isProduction && !databaseUrl) {
    console.warn('⚠️ WARNING: DATABASE_URL not set in production. Using durable SQL file fallback.');
    const durableDir = path.join(process.cwd(), '.veil_cloud_db');
    cloudDb = new SqlCloudDatabase(`file://${durableDir}`);
  } else {
    const defaultDir = path.join(process.cwd(), '.veil_cloud_db');
    console.log(`🗄️ Database Backend: FileCloudDatabase (${defaultDir})`);
    cloudDb = new FileCloudDatabase(defaultDir);
  }
  await cloudDb.init();

  // 3. Initialize Object Storage
  let objectStorage: IObjectStorage;
  if (s3Endpoint || (process.env.OBJECT_STORAGE_ACCESS_KEY && process.env.OBJECT_STORAGE_SECRET_KEY)) {
    console.log(`☁️ Object Storage: S3-Compatible SigV4 (${s3Endpoint || 'AWS S3'})`);
    objectStorage = new S3ObjectStorage();
  } else {
    const objectDir = path.join(process.cwd(), '.veil_object_store');
    console.log(`💾 Object Storage: Local Disk Storage (${objectDir})`);
    objectStorage = new LocalDiskObjectStorage(objectDir);
  }
  await objectStorage.init();

  // 4. Start Relay Server with full cloud persistence
  const server = new RelayServer(
    {
      port,
      host,
      logLevel: (process.env.RELAY_LOG_LEVEL as any) || 'info',
    },
    store,
    cloudDb,
    objectStorage
  );

  const address = await server.start();
  console.log(`🚀 VEIL Relay Server listening on http://${address.host}:${address.port}`);
  console.log(`⚡ WebSocket endpoint: ws://${address.host}:${address.port}/v1/ws`);
  console.log(`🩺 Health check: http://${address.host}:${address.port}/healthz`);
  console.log(`🩺 Readiness check: http://${address.host}:${address.port}/readyz`);

  const shutdown = async () => {
    console.log('\n🛑 Shutting down VEIL Relay Server...');
    await server.stop();
    await store.close();
    await cloudDb.close();
    await objectStorage.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error starting VEIL Relay Server:', err);
  process.exit(1);
});
