/**
 * Production Database Migration Runner for VEIL Cloud Database.
 *
 * Implements deterministic, version-tracked database migrations for SQL backends
 * (PostgreSQL & SQLite) and file-backed database stores.
 *
 * MIGRATION INVARIANTS:
 * - Deterministic sequential execution.
 * - Idempotency: Re-running migrations is a no-op and never resets data.
 * - Non-destructive schema evolution.
 */

export interface Migration {
  id: string;
  name: string;
  version: number;
  upSql: string;
  description: string;
}

export const INITIAL_SCHEMA_MIGRATION: Migration = {
  id: '001_initial_cloud_schema',
  name: 'Initial VEIL Cloud Database Schema',
  version: 1,
  description: 'Creates accounts, devices, sessions, spaces, messages, attachments, sync_states, recovery_states tables',
  upSql: `
    CREATE TABLE IF NOT EXISTS _veil_migrations (
      id VARCHAR(255) PRIMARY KEY,
      version INTEGER NOT NULL,
      applied_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      account_id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      auth_hash VARCHAR(255) NOT NULL,
      auth_salt VARCHAR(255) NOT NULL,
      recovery_anchor TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);

    CREATE TABLE IF NOT EXISTS devices (
      device_id VARCHAR(64) PRIMARY KEY,
      account_id VARCHAR(64) NOT NULL,
      device_name VARCHAR(128) NOT NULL,
      signing_pub VARCHAR(255) NOT NULL,
      key_agreement_pub VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      created_at BIGINT NOT NULL,
      last_seen_at BIGINT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_devices_account ON devices(account_id);

    CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(64) PRIMARY KEY,
      account_id VARCHAR(64) NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      token_hash VARCHAR(64) UNIQUE NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      revoked_at BIGINT,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);

    CREATE TABLE IF NOT EXISTS spaces (
      space_id VARCHAR(64) PRIMARY KEY,
      account_id VARCHAR(64) NOT NULL,
      encrypted_header TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      deleted_at BIGINT,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_spaces_account ON spaces(account_id);

    CREATE TABLE IF NOT EXISTS messages (
      message_id VARCHAR(64) PRIMARY KEY,
      account_id VARCHAR(64) NOT NULL,
      space_id VARCHAR(64) NOT NULL,
      conversation_id VARCHAR(128) NOT NULL,
      sender_device_id VARCHAR(64) NOT NULL,
      encrypted_payload TEXT NOT NULL,
      nonce VARCHAR(64) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      deleted_at BIGINT,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
      FOREIGN KEY (space_id) REFERENCES spaces(space_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_space_ver ON messages(space_id, version);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(space_id, conversation_id);

    CREATE TABLE IF NOT EXISTS attachments (
      attachment_id VARCHAR(64) PRIMARY KEY,
      account_id VARCHAR(64) NOT NULL,
      space_id VARCHAR(64) NOT NULL,
      object_id VARCHAR(64) UNIQUE NOT NULL,
      encrypted_metadata TEXT,
      ciphertext_size BIGINT NOT NULL,
      ciphertext_hash VARCHAR(64) NOT NULL,
      encryption_version INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(32) NOT NULL DEFAULT 'UPLOADING',
      chunk_count INTEGER NOT NULL DEFAULT 1,
      chunk_size INTEGER NOT NULL DEFAULT 65536,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      deleted_at BIGINT,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
      FOREIGN KEY (space_id) REFERENCES spaces(space_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_object_id ON attachments(object_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_space ON attachments(space_id);

    CREATE TABLE IF NOT EXISTS sync_states (
      account_id VARCHAR(64) NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      space_id VARCHAR(64) NOT NULL,
      last_sync_cursor BIGINT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (account_id, device_id, space_id),
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recovery_states (
      account_id VARCHAR(64) PRIMARY KEY,
      recovery_id VARCHAR(64) NOT NULL,
      encrypted_vault_blob TEXT NOT NULL,
      kdf_params TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
    );
  `,
};

export class MigrationRunner {
  private appliedMigrations = new Set<string>();

  /**
   * Returns all available migrations in order.
   */
  public getMigrations(): Migration[] {
    return [INITIAL_SCHEMA_MIGRATION];
  }

  /**
   * Applies all pending migrations to a target SQL executor function.
   */
  public async runMigrations(
    executeSql: (sql: string) => Promise<void>,
    isApplied: (migrationId: string) => Promise<boolean>,
    recordApplied: (migrationId: string, version: number) => Promise<void>
  ): Promise<{ appliedCount: number; migrations: string[] }> {
    const migrations = this.getMigrations();
    const newlyApplied: string[] = [];

    for (const m of migrations) {
      const alreadyApplied = await isApplied(m.id);
      if (!alreadyApplied) {
        await executeSql(m.upSql);
        await recordApplied(m.id, m.version);
        this.appliedMigrations.add(m.id);
        newlyApplied.push(m.id);
      } else {
        this.appliedMigrations.add(m.id);
      }
    }

    return {
      appliedCount: newlyApplied.length,
      migrations: newlyApplied,
    };
  }
}
