# VEIL PostgreSQL Database Layer & Durable Persistence

## 1. Overview

VEIL Phase 29 implements a durable SQL database layer (`SqlCloudDatabase`) supporting PostgreSQL connection strings and local durable file-backed persistence.

---

## 2. Relational Schema & Tables

1. **`cloud_accounts`**:
   - `account_id` (PK, UUID)
   - `username` (UNIQUE, 3–32 chars)
   - `password_hash` (Argon2id client-derived verifier)
   - `recovery_anchor`
   - `created_at`, `updated_at`

2. **`cloud_devices`**:
   - `device_id` (PK, text)
   - `account_id` (FK -> cloud_accounts)
   - `device_name`
   - `device_signing_pub` (Ed25519)
   - `device_key_agreement_pub` (X25519)
   - `last_seen_at`

3. **`cloud_spaces`**:
   - `space_id` (PK, UUID)
   - `account_id` (FK -> cloud_accounts)
   - `encrypted_metadata` (AES/XChaCha ciphertext)
   - `created_at`

4. **`cloud_messages`**:
   - `message_id` (PK, text)
   - `space_id` (FK -> cloud_spaces)
   - `sender_device_id` (FK -> cloud_devices)
   - `recipient_space_id`
   - `encrypted_payload` (Double Ratchet ciphertext)
   - `nonce`
   - `version`
   - `created_at`, `updated_at`, `deleted_at`

5. **`cloud_attachments`**:
   - `attachment_id` (PK, text)
   - `account_id` (FK -> cloud_accounts)
   - `space_id` (FK -> cloud_spaces)
   - `object_id` (S3 object key)
   - `ciphertext_size`, `ciphertext_hash`
   - `status` ('ACTIVE' | 'DELETED')

6. **`cloud_recovery_state`**:
   - `account_id` (PK, FK -> cloud_accounts)
   - `encrypted_vault_blob` (Zero-knowledge encrypted identity backup)
   - `kdf_params` (Argon2id config JSON)
   - `version`, `updated_at`

---

## 3. Schema Migrations

The `MigrationRunner` applies versioned DDL migrations (`001_initial_schema.sql`, `002_add_foreign_keys.sql`, `003_recovery_vault.sql`) automatically on startup.
