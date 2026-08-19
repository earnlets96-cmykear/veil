# PRODUCTION_DEPLOYMENT.md — VEIL Production Cloud & Infrastructure Operations Manual

## 1. Production Architecture Overview

The VEIL Production Infrastructure is a multi-tier, zero-knowledge cloud platform serving Web, Android, and Desktop clients:

```text
                           INTERNET
                              │
                       relay.veil.chat
                              │
                 ┌────────────┴────────────┐
                 │  Caddy / TLS 1.3 Proxy  │  (Port 443 -> 8787)
                 └────────────┬────────────┘
                              │ (Internal Network)
                 ┌────────────┴────────────┐
                 │   VEIL Cloud Backend    │
                 │  (Node.js / TypeScript) │
                 └──────┬───────────┬──────┘
                        │           │
             ┌──────────┴──┐     ┌──┴─────────────┐
             │ Production  │     │ S3 Object      │
             │ PostgreSQL  │     │ Storage        │
             │ Database    │     │ (MinIO / R2)   │
             └─────────────┘     └────────────────┘
```

---

## 2. Infrastructure Components & Configuration

### A. Database (PostgreSQL)
- **Engine**: PostgreSQL 16 (or SQLite development/test adapter).
- **Driver Abstraction**: `ICloudDatabase` ([`src/server/cloud/database/types.ts`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/src/server/cloud/database/types.ts)) with `SqlCloudDatabase` and `FileCloudDatabase`.
- **Migrations**: Managed deterministically by `MigrationRunner` ([`src/server/cloud/database/migrations/migrationRunner.ts`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/src/server/cloud/database/migrations/migrationRunner.ts)).
- **Connection URI**: `postgresql://veil:<POSTGRES_PASSWORD>@postgres:5432/veil_db`

### B. Object Storage (S3-Compatible)
- **Engine**: S3-compatible cloud object storage (AWS S3, MinIO, Cloudflare R2, GCP Storage).
- **Driver Abstraction**: `IObjectStorage` ([`src/server/cloud/storage/types.ts`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/src/server/cloud/storage/types.ts)) with `S3ObjectStorage`.
- **Security**: Bucket is strictly private (`private` ACL). Only authenticated ciphertexts are uploaded.

### C. Reverse Proxy & TLS Termination (Caddy)
- **Domain**: `relay.veil.chat`
- **TLS**: TLS 1.3 strict enforcement, automatic Let's Encrypt / ZeroSSL certificate management.
- **WebSocket**: Direct upgrade proxying on `/v1/ws` with unbounded connection life.
- **Config**: [`deployment/Caddyfile.production`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/deployment/Caddyfile.production).

---

## 3. Environment Variables & Secret Management

Production secrets MUST exist outside the source repository:

| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `RELAY_HOST` | Binding interface | `0.0.0.0` |
| `RELAY_PORT` | Binding port | `8787` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `OBJECT_STORAGE_ENDPOINT` | S3 API endpoint | `https://s3.us-east-1.amazonaws.com` |
| `OBJECT_STORAGE_BUCKET` | S3 bucket name | `veil-encrypted-attachments` |
| `OBJECT_STORAGE_ACCESS_KEY` | S3 IAM access key | Secret string |
| `OBJECT_STORAGE_SECRET_KEY` | S3 IAM secret key | Secret string |
| `SESSION_SECRET` | 256-bit session secret | 64-character hex |

---

## 4. Turnkey Docker Deployment

To launch the complete production stack on a Linux host:

```bash
# 1. Clone repository & configure environment
cd deployment/docker
cp ../../.env.example .env
# Fill in real production passwords in .env

# 2. Start the full production stack
docker compose -f docker-compose.production.yml up -d

# 3. Verify services are healthy
docker compose -f docker-compose.production.yml ps
```

---

## 5. Backup, Restoration & Disaster Recovery

### Automated Backup Procedure
Run the production backup utility to archive database tables and object storage:
```bash
node scripts/production-backup.mjs --backup /backups/veil_prod_$(date +%Y%m%d).json
```

### Full Disaster Recovery / Restore Procedure
1. Stop backend services:
   ```bash
   docker compose -f docker-compose.production.yml stop veil-backend
   ```
2. Restore database and object storage from backup archive:
   ```bash
   node scripts/production-backup.mjs --restore /backups/veil_prod_target.json
   ```
3. Restart backend services:
   ```bash
   docker compose -f docker-compose.production.yml start veil-backend
   ```
4. Verify readiness:
   ```bash
   curl -f http://127.0.0.1:8787/readyz
   ```

---

## 6. Health, Readiness & Observability

- **Liveness Probe**: `GET /healthz`
  - Returns `200 OK` with uptime and protocol version.
- **Readiness Probe**: `GET /readyz`
  - Validates that the database and object storage adapters are initialized and ready to serve client requests.

---

## 7. Status Clarification: Deployment-Ready vs. Actually Deployed

- **Code & Infrastructure Status**: **PHASE 28 DEPLOYMENT-READY & CERTIFIED**.
- All Docker Compose manifests, Caddyfile configurations, SQL migration scripts, S3 object storage adapters, and automated backup/restore tools are fully implemented and tested.
- Connecting to `https://relay.veil.chat` over the public internet requires pointing DNS A/AAAA records for `relay.veil.chat` to the production server IP and provisioning TLS.
