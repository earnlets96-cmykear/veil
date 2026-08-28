/**
 * Production PostgreSQL Client Wrapper for VEIL.
 *
 * Implements connection pooling, retries on transient errors,
 * parameterized query execution, transaction support, and health checks.
 */

import pg from 'pg';
import * as fs from 'fs';
const { Pool } = pg;

export interface PostgresClientConfig {
  connectionString: string;
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

function resolveSslConfig(connectionString: string): boolean | pg.ConnectionConfig['ssl'] {
  if (connectionString.includes('sslmode=disable')) {
    return false;
  }

  // 1. Check for custom CA certificate file if provided
  const caCertPath = process.env.PGSSLROOTCERT || process.env.SUPABASE_CA_CERT;
  if (caCertPath && fs.existsSync(caCertPath)) {
    try {
      const ca = fs.readFileSync(caCertPath, 'utf8');
      return {
        rejectUnauthorized: true,
        ca,
      };
    } catch (_e) {
      // Fall through to default
    }
  }

  // 2. Strict verification if requested via connection string or env var
  if (connectionString.includes('sslmode=verify-full') || process.env.SSL_VERIFY === 'true') {
    return { rejectUnauthorized: true };
  }

  // 3. Default to TLS encryption with SNI support for cloud poolers
  return { rejectUnauthorized: false };
}

export class PostgresClient {
  private pool: pg.Pool;
  private connectionString: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private isConnected = false;

  constructor(config: PostgresClientConfig | string) {
    if (typeof config === 'string') {
      this.connectionString = config;
      this.maxRetries = 3;
      this.retryDelayMs = 500;
      this.pool = new Pool({
        connectionString: config,
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: resolveSslConfig(config),
      });
    } else {
      this.connectionString = config.connectionString;
      this.maxRetries = config.maxRetries ?? 3;
      this.retryDelayMs = config.retryDelayMs ?? 500;
      this.pool = new Pool({
        connectionString: config.connectionString,
        max: config.maxConnections || 10,
        min: config.minConnections || 2,
        idleTimeoutMillis: config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
        ssl: resolveSslConfig(config.connectionString),
      });
    }

    // Suppress unhandled pool error events
    this.pool.on('error', (err) => {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[VEIL-PG] Unexpected client error on idle connection:', err.message);
      }
    });
  }

  /**
   * Initializes the pool and verifies basic connectivity.
   */
  public async init(): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const client = await this.pool.connect();
        try {
          await client.query('SELECT 1');
          this.isConnected = true;
          return;
        } finally {
          client.release();
        }
      } catch (err: any) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise((res) => setTimeout(res, this.retryDelayMs * Math.pow(2, attempt - 1)));
        }
      }
    }
    this.isConnected = false;
    throw new Error(`[VEIL-PG] Failed to connect to PostgreSQL database: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Executes a parameterized query with automatic retry on transient connection failures.
   */
  public async query<T extends pg.QueryResultRow = any>(sql: string, params: any[] = []): Promise<pg.QueryResult<T>> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.pool.query<T>(sql, params);
      } catch (err: any) {
        lastError = err;
        // Retry only on transient connection / socket errors
        const isTransient =
          err.code === 'ECONNRESET' ||
          err.code === '57P01' || // admin shutdown
          err.code === '08006' || // connection failure
          err.code === '08001' || // unable to establish SQL connection
          err.message?.includes('Connection terminated') ||
          err.message?.includes('socket has been ended');

        if (isTransient && attempt < this.maxRetries) {
          await new Promise((res) => setTimeout(res, this.retryDelayMs * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Executes a function inside a managed SQL transaction.
   */
  public async withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackErr) {}
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Checks if database connection is alive.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 as alive');
      return res.rows.length > 0 && res.rows[0].alive === 1;
    } catch (_e) {
      return false;
    }
  }

  /**
   * Closes the connection pool gracefully.
   */
  public async close(): Promise<void> {
    this.isConnected = false;
    await this.pool.end();
  }

  public getRawPool(): pg.Pool {
    return this.pool;
  }
}
