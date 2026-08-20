# PHASE29_PRODUCTION_AUDIT.md — VEIL Production Infrastructure Audit

## 1. Executive Summary

This audit evaluates the real-world production deployment and persistence readiness of VEIL following Phase 28. While Phase 28 designed schemas, Docker Compose stacks, and test harnesses, this audit reveals critical gaps preventing true cloud persistence and multi-device continuity in production deployments (including Render).

---

## 2. Detailed Audit Findings

### A. Database Reality & Connection Status
1. **Actual Database Initialized by CLI**:
   - `src/server/cli.ts` (the startup entrypoint for `npm run relay` and Render/Docker) only initializes `PersistentFileRelayStore(storageDir)` and passes it to `RelayServer`.
   - `cli.ts` **never instantiates** `SqlCloudDatabase` or `FileCloudDatabase`.
   - `RelayServer` falls back to `new MemoryCloudDatabase()` when `cloudDb` is undefined.
   - **Impact**: In deployed environments (Render, VMs, containers), every restart, deployment, or container lifecycle event **completely wipes all registered accounts, sessions, recovery vaults, and sync cursors from RAM**.

2. **PostgreSQL Adapter Architecture**:
   - `src/server/cloud/database/sqlCloudDatabase.ts` implements `ICloudDatabase` using in-memory JavaScript `Map` structures rather than executing real SQL queries via a PostgreSQL client connection.
   - The migration runner executes a no-op callback `async (_sql) => {}`.
   - **Impact**: Even when `DATABASE_URL` is configured, data is held in memory and does not hit PostgreSQL tables.

### B. Object Storage Reality & Attachment Handling
1. **S3 Adapter Implementation**:
   - `src/server/cloud/storage/s3ObjectStorage.ts` implements `IObjectStorage` using an in-memory map (`this.inMemoryCache = new Map()`). It does not issue AWS Signature Version 4 HTTP requests to S3/MinIO endpoints.
   - `cli.ts` defaults to `LocalDiskObjectStorage` which writes to local `.veil_object_store`.
   - **Impact**: Uploaded attachments on Render are written to local disk (which is ephemeral) or stored in RAM, causing attachments to disappear on redeploy/restart.

2. **Attachment Multi-Party Access Authorization Flaw**:
   - In `src/server/cloud/cloudHandler.ts` (`handleAttachmentDownload`), the authorization check strictly enforces `attRecord.accountId !== accountId`.
   - When User A (Alice) uploads an attachment and User B (Bob) tries to download it in their conversation, Bob's download is rejected with `404: Attachment not found or access denied`.
   - **Impact**: Recipients in conversations cannot download sender attachments.

### C. Render Deployment Configuration
1. **Blueprint Configuration (`render.yaml`)**:
   - `render.yaml` sets `RELAY_STORAGE_DIR: /tmp/veil_relay_data` and `DATABASE_URL: file:///tmp/veil_cloud_db`.
   - Render's `/tmp` directory is ephemeral and wiped on spin-down, deployment, or restart.
   - No managed PostgreSQL database service or external S3/MinIO bucket is provisioned in `render.yaml`.
   - **Impact**: Render deployments lose all data on every server restart.

### D. Client-Side Account Lifecycle & Identity Restoration
1. **LockScreen UI & Reinstall Recovery**:
   - `LockScreen.tsx` only offers "Unlock Space" (against local IndexedDB) and "+ Create New Space".
   - There is no UI flow to "Log In to Account" or "Restore Identity from Cloud Backup" on a fresh browser, cleared app, or new Android device.
   - If local IndexedDB is cleared, the user is forced to create a new Space, which generates a new random Ed25519 identity key, breaking conversation continuity and contact graphs.

2. **SyncEngine Integration**:
   - `AppState.tsx` does not automatically initialize or trigger `SyncEngine.sync()` upon unlocking a Space, meaning cloud messages are not pulled or reconciled into the active conversation timeline.

### E. Missing Feature Capabilities
1. **Voice Messaging**:
   - Missing: Microphone capture, audio recording timer, MediaRecorder encoding, client-side AEAD chunking, S3 upload, audio waveform/player UI in chat timeline.
2. **Message Replies & Quotes**:
   - Missing: Reply action on message bubbles, quoted message banner above composer, wire representation `replyToMessageId`, jump-to-original message navigation.

---

## 3. Mandatory Remediation Checklist for Phase 29

- [ ] **1. Production Server CLI Activation**: Update `src/server/cli.ts` to detect `DATABASE_URL` (PostgreSQL / durable file) and `OBJECT_STORAGE_ENDPOINT` (S3 / MinIO) and inject real persistent adapters into `RelayServer`.
- [ ] **2. Pure-TS Production PostgreSQL Adapter**: Connect `SqlCloudDatabase` to real PostgreSQL instances (supporting SSL, pooling, and versioned DDL migrations) without native dependencies.
- [ ] **3. Pure-TS S3 SigV4 Object Storage Adapter**: Implement AWS Signature Version 4 REST client in `S3ObjectStorage` using native `fetch` and `@noble/hashes` for AWS S3, Cloudflare R2, MinIO, and GCP.
- [ ] **4. Recipient Attachment Access Control**: Allow conversation participants to authorize and download attachments securely based on conversation/message authorization.
- [ ] **5. Cloud Identity Backup & Reinstall Recovery**: Implement zero-knowledge encrypted identity backup (`EncryptedIdentityBackup`) allowing users to restore their exact same Ed25519 `identityId` on fresh devices.
- [ ] **6. UI Account Login & Cloud Recovery Flow**: Add "Log In / Restore Account" on `LockScreen.tsx` and account management in `SettingsModal.tsx`.
- [ ] **7. Voice Messaging Pipeline**: Implement encrypted voice notes (`MediaRecorder` -> client-side XChaCha20-Poly1305 -> S3 -> audio playback in timeline).
- [ ] **8. Message Replies & Quotes**: Implement `replyToMessageId`, preview banners, quote rendering, and jump-to-target navigation.
- [ ] **9. Real Smoke & Acceptance Tests**: Author `scripts/phase29-production-smoke.mjs` and comprehensive regression test suites.
- [ ] **10. Render Deployment Blueprint Update**: Configure `render.yaml` with durable database and object storage configuration.
