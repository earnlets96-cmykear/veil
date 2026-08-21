/**
 * VEIL Standalone Relay Server CLI Entrypoint.
 *
 * Starts the relay server with configurable port, host, storage directory,
 * durable cloud database (Supabase PostgreSQL / SQLite / File), and S3/R2 object storage.
 */

import { RelayServer } from './relayServer.ts';
import { PersistentFileRelayStore } from './storage/persistentRelayStore.ts';
import { PostgresRelayStore } from './storage/postgresRelayStore.ts';
import { SqlCloudDatabase } from './cloud/database/sqlCloudDatabase.ts';
import { FileCloudDatabase } from './cloud/database/fileCloudDatabase.ts';
import { S3ObjectStorage } from './cloud/storage/s3ObjectStorage.ts';
import { LocalDiskObjectStorage } from './cloud/storage/localDiskObjectStorage.ts';
import type { IRelayStore } from './storage/relayStore.ts';
import type { ICloudDatabase } from './cloud/database/types.ts';
import type { IObjectStorage } from './cloud/storage/types.ts';
import * as path from 'path';

const port = parseInt(process.env.RELAY_PORT || process.env.PORT || '8787', 10);
const host = process.env.RELAY_HOST || '0.0.0.0';
const storageDir = process.env.RELAY_STORAGE_DIR || path.join(process.cwd(), '.veil_relay_data');
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL || '';
const hasR2 = !!(process.env.R2_ENDPOINT || process.env.R2_ACCESS_KEY_ID);
const hasS3 = !!(
  process.env.OBJECT_STORAGE_ENDPOINT ||
  process.env.S3_ENDPOINT ||
  (process.env.OBJECT_STORAGE_ACCESS_KEY && process.env.OBJECT_STORAGE_SECRET_KEY) ||
  (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)
);

async function main() {
  console.log('🛡️ Starting VEIL Blind Relay & Cloud Persistence Server...');
  console.log(`📦 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

  // Strict Fail-Closed Verification in Production
  if (isProduction) {
    if (!databaseUrl || (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://'))) {
      throw new Error(
        '🛑 [VEIL-CONFIG] FATAL: DATABASE_URL must be a valid Supabase / PostgreSQL connection string in production. Fail-closed.'
      );
    }
    if (!hasR2 && !hasS3) {
      throw new Error(
        '🛑 [VEIL-CONFIG] FATAL: Cloudflare R2 / S3 credentials (R2_ENDPOINT / OBJECT_STORAGE_ENDPOINT) are mandatory in production. Fail-closed.'
      );
    }
  }

  // 1. Initialize Relay Store & Cloud Database
  let store: IRelayStore;
  let cloudDb: ICloudDatabase;

  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    console.log(`🗄️ Database Backend: Supabase PostgreSQL (${databaseUrl.split('@')[1] || 'postgresql'})`);
    cloudDb = new SqlCloudDatabase(databaseUrl);
    store = new PostgresRelayStore(databaseUrl);
  } else if (databaseUrl.startsWith('file://') || databaseUrl.includes('.json')) {
    console.log(`🗄️ Database Backend: File-backed SQL Database`);
    cloudDb = new SqlCloudDatabase(databaseUrl);
    store = new PersistentFileRelayStore(storageDir);
  } else {
    const defaultDir = path.join(process.cwd(), '.veil_cloud_db');
    console.log(`🗄️ Database Backend: FileCloudDatabase (${defaultDir})`);
    cloudDb = new FileCloudDatabase(defaultDir);
    store = new PersistentFileRelayStore(storageDir);
  }

  await cloudDb.init();
  await store.init();

  // 2. Initialize Object Storage
  let objectStorage: IObjectStorage;
  if (hasR2 || hasS3) {
    const endpointDesc = process.env.R2_ENDPOINT ? 'Cloudflare R2' : 'S3-Compatible SigV4';
    console.log(`☁️ Object Storage: ${endpointDesc}`);
    objectStorage = new S3ObjectStorage();
  } else {
    const objectDir = path.join(process.cwd(), '.veil_object_store');
    console.log(`💾 Object Storage: Local Disk Storage (${objectDir})`);
    objectStorage = new LocalDiskObjectStorage(objectDir);
  }
  await objectStorage.init();

  // 3. Start Relay Server with full cloud persistence
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
  console.log(`🩺 Health check: http://${address.host}:${address.port}/health`);
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
