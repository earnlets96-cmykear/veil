# Render Deployment & Web Service Configuration

## 1. Overview
VEIL is deployed to Render as a stateless Web Service utilizing Node.js / TypeScript.

---

## 2. Infrastructure as Code: `render.yaml`

```yaml
services:
  - type: web
    name: veil-relay
    runtime: node
    plan: starter
    region: oregon
    buildCommand: npm ci && npm run build
    startCommand: node --loader tsx src/server/cli.ts
    healthCheckPath: /healthz
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: R2_ENDPOINT
        sync: false
      - key: R2_BUCKET
        sync: false
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
      - key: R2_REGION
        value: auto
      - key: ALLOWED_ORIGINS
        value: https://veil-chat.onrender.com,http://localhost:5173
```

---

## 3. Fail-Closed Production Behavior

When `NODE_ENV === 'production'`:
- `DATABASE_URL` MUST be present and start with `postgres://` or `postgresql://`. If missing or invalid, the relay terminates immediately on boot with code 1.
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (or `OBJECT_STORAGE_*` equivalents) MUST be configured.
- `/healthz` and `/readyz` report `{"status": "ok", "database": "connected", "objectStorage": "ok"}`.
