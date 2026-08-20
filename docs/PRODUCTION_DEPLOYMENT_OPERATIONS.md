# VEIL Production Deployment & Operations Runbook

## 1. Prerequisites & Environment Variables

When deploying VEIL to production environments (e.g. Render, AWS, Railway, Docker):

| Environment Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection URL | `postgresql://user:pass@ep-xyz.render.com/veil` |
| `OBJECT_STORAGE_ENDPOINT` | **Yes** | S3-compatible REST API endpoint | `https://s3.us-east-1.amazonaws.com` |
| `OBJECT_STORAGE_BUCKET` | **Yes** | Target S3 bucket name | `veil-production-media` |
| `OBJECT_STORAGE_REGION` | **Yes** | AWS/S3 region | `us-east-1` |
| `OBJECT_STORAGE_ACCESS_KEY` | **Yes** | Access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `OBJECT_STORAGE_SECRET_KEY` | **Yes** | Secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `OBJECT_STORAGE_FORCE_PATH_STYLE` | No | Path style routing (MinIO/R2) | `false` |
| `NODE_ENV` | **Yes** | Environment mode | `production` |
| `PORT` | No | HTTP / WebSocket listen port | `8787` |

---

## 2. Server Startup & Architecture

Start the production server via:
```bash
npm run start
# Or directly:
node dist/server/cli.js
```

### Automatic Startup Sequence:
1. `cli.ts` checks `process.env.DATABASE_URL` and instantiates `SqlCloudDatabase`.
2. `SqlCloudDatabase.init()` connects to PostgreSQL and runs all pending migrations.
3. `cli.ts` checks `process.env.OBJECT_STORAGE_*` and instantiates `S3ObjectStorage`.
4. `RelayServer` starts and binds WebSocket handler, REST mailbox endpoints, directory endpoints, and cloud persistence routes.

---

## 3. Database Backup & Disaster Recovery

- **Atomic Database Dump**:
  ```bash
  pg_dump "$DATABASE_URL" > veil_backup_$(date +%Y%m%d).sql
  ```
- **Automated Backup Utility**:
  ```typescript
  import { createBackup } from './src/server/cloud/backup.ts';
  await createBackup(cloudDb, objectStorage, 'backups/daily.json');
  ```
