# Supabase PostgreSQL Setup & Configuration Guide

## 1. Prerequisites
- A Supabase account and active project.

---

## 2. Obtaining Connection String
1. In your Supabase project dashboard, navigate to **Project Settings** > **Database**.
2. Under **Connection string**, select **URI**.
3. Choose the **Connection Pooler** mode (recommended for Render serverless/container instances) using port `6543`.
4. Set SSL mode to `sslmode=require`.

Example format:
```
postgresql://postgres.yourprojectref:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

---

## 3. Automatic Schema Migrations
VEIL automatically checks and applies all pending SQL schema migrations upon server startup using `MigrationRunner` (`001_initial_cloud_schema`, `002_relay_and_directory_persistence`). No manual database table creation is necessary.

---

## 4. Verification
Run the health check endpoint to verify database connectivity:
```bash
curl https://your-veil-relay.onrender.com/healthz
```
Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "objectStorage": "connected",
  "protocolVersion": "v1",
  "uptimeSeconds": 42
}
```
