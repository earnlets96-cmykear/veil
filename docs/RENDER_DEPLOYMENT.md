# Render Deployment & Web Service Configuration

## 1. Overview
VEIL backend relay is deployed to Render as a Web Service utilizing Node.js / TypeScript.

---

## 2. Infrastructure as Code: `render.yaml`

```yaml
services:
  - type: web
    name: veil-backend
    env: node
    plan: starter
    region: oregon
    buildCommand: npm ci --include=dev && npm run build
    startCommand: npm run start:server
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false # Supabase PostgreSQL connection string
      - key: R2_ENDPOINT
        sync: false # Cloudflare R2 endpoint
      - key: R2_BUCKET
        value: veil-attachments
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
      - key: R2_REGION
        value: auto
```

---

## 3. Host & Port Binding
- **Host**: Server binds to `0.0.0.0` by default (configurable via `RELAY_HOST`).
- **Port**: Server binds dynamically to Render's injected `$PORT` environment variable (falling back to `RELAY_PORT` or `8787`).

---

## 4. Health Check Endpoint

### `GET /health` (or `GET /healthz`)
Lightweight, unauthenticated liveness and keep-alive probe.

- **HTTP Method**: `GET`
- **Path**: `/health` (or `/healthz`)
- **Authentication**: None required
- **Database / R2 Operations**: None (guaranteed non-blocking, <1ms response)
- **Response Code**: `200 OK`
- **Content-Type**: `application/json`
- **Response Payload**:
  ```json
  {
    "status": "ok",
    "protocolVersion": "v1",
    "uptimeSeconds": 142
  }
  ```

### `GET /readyz`
Comprehensive readiness probe verifying database connectivity and object store availability.

- **Response Code**: `200 OK` (or `503 Service Unavailable` if database is disconnected)
- **Response Payload**:
  ```json
  {
    "status": "ready",
    "database": "connected",
    "cloudDb": "ok",
    "objectStorage": "ok",
    "store": "ok",
    "protocolVersion": "v1"
  }
  ```

---

## 5. Keep-Alive Strategy (Preventing Render Spin-Down)

Render free-tier web services automatically spin down after 15 minutes of inactivity. To keep the service warm and responsive:

1. **External Ping Service**: Configure an external monitoring service (such as UptimeRobot, Cron-job.org, BetterUptime, or a GitHub Actions cron schedule).
2. **Target URL**: `https://<your-service-name>.onrender.com/health`
3. **HTTP Method**: `GET`
4. **Recommended Interval**: Every **10 minutes** (conservative interval safely below the 15-minute idle limit).
5. **No Internal Loops**: The backend intentionally does not run self-pinging `setInterval` loops, keeping resource utilization minimal.

---

## 6. Manual Verification

Run curl against your deployed or local service:
```bash
curl -i http://localhost:8787/health
```

Expected output:
```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *

{"status":"ok","protocolVersion":"v1","uptimeSeconds":5}
```
