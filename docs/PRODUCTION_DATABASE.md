# Production Database: Supabase PostgreSQL Architecture

## 1. Overview
VEIL uses PostgreSQL via Supabase connection pooling for relational data. The database layer is designed to be fully zero-knowledge: no plaintext message contents, user passwords, private keys, or recovery passphrases ever enter the database.

---

## 2. Connection Management & Driver (`postgresClient.ts`)

- **Driver**: `pg` (Node Postgres) with `pg.Pool`.
- **Pool Sizing**:
  - `min`: 2 connections (readiness baseline).
  - `max`: 10 connections (tailored for serverless / pooled Supabase environments).
  - `idleTimeoutMillis`: 30,000 ms.
  - `connectionTimeoutMillis`: 5,000 ms.
- **SSL Configuration**:
  - `ssl: { rejectUnauthorized: false }` for secure TLS communication with cloud-hosted database endpoints.
- **Retries**:
  - Automatic exponential backoff (up to 3 attempts) on transient connection drops (`ECONNRESET`, `57P01`, `ETIMEDOUT`).

---

## 3. Database Schema Migrations

### Migration `001_initial_cloud_schema`
1. `accounts`:
   - `account_id` (PK), `username` (UNIQUE), `auth_hash`, `auth_salt`, `recovery_anchor`, `created_at`, `updated_at`.
2. `devices`:
   - `device_id` (PK), `account_id` (FK), `device_name`, `signing_public_key`, `key_agreement_public_key`, `status`, `created_at`, `last_seen_at`.
3. `sessions`:
   - `session_id` (PK), `account_id` (FK), `device_id` (FK), `session_token_hash` (UNIQUE), `created_at`, `expires_at`.
4. `spaces`:
   - `account_id` + `space_id` (Composite PK), `encrypted_header`, `header_nonce`, `space_name`, `version`, `created_at`, `updated_at`.
5. `messages`:
   - `account_id` + `space_id` + `message_id` (Composite PK), `sender_device_id`, `recipient_address`, `ciphertext`, `nonce`, `message_type`, `version`, `created_at`, `updated_at`.
6. `attachments`:
   - `account_id` + `space_id` + `attachment_id` (Composite PK), `object_id` (UNIQUE), `encrypted_metadata`, `ciphertext_size`, `ciphertext_hash`, `encryption_version`, `status`, `created_at`, `updated_at`.
7. `recovery_state`:
   - `account_id` (PK), `recovery_id`, `encrypted_vault_blob`, `kdf_params`, `updated_at`.

### Migration `002_relay_and_directory_persistence`
1. `relay_mailboxes`:
   - `mailbox_id` (PK), `capability_hash`, `created_at`, `expires_at`, `last_active_at`.
2. `relay_envelopes`:
   - `envelope_id` (PK), `mailbox_id` (FK), `payload`, `size_bytes`, `created_at`, `expires_at`.
3. `directory_profiles`:
   - `username` (PK, lowercase), `identity_id` (UNIQUE), `display_name`, `avatar_url`, `signing_public_key`, `key_agreement_public_key`, `mailbox_id`, `prekey_bundle_json`, `signature`, `created_at`, `updated_at`.
4. `contact_requests`:
   - `request_id` (PK), `sender_identity_id`, `recipient_identity_id`, `encrypted_intro`, `signature`, `status`, `created_at`, `updated_at`.
