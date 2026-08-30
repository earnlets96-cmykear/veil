# VEIL Blind Relay Server — Deployment & Operations Manual

This directory contains turnkey deployment artifacts and configuration templates for hosting an independent VEIL Blind Relay daemon.

---

## 🏗️ Architecture Overview

```
                        [ Client A ]                [ Client B ]
                             │                           │
                             └────────────┬──────────────┘
                                          │ (WSS / HTTPS)
                                          ▼
                             ┌─────────────────────────┐
                             │  Reverse Proxy / TLS    │
                             │  (Caddy / Nginx)        │
                             └────────────┬────────────┘
                                          │ (Local HTTP/WS)
                                          ▼
                             ┌─────────────────────────┐
                             │  VEIL Relay Server      │
                             │  (Node.js / tsx)        │
                             └────────────┬────────────┘
                                          │ (Atomic FS writes)
                                          ▼
                             ┌─────────────────────────┐
                             │  Persistent Storage     │
                             │  (/var/lib/veil/storage)│
                             └─────────────────────────┘
```

---

## 🚀 Deployment Options

### Option 1: Native Systemd Service (Recommended for Linux)
1. Copy repository to `/opt/veil`:
   ```bash
   git clone <repo-url> /opt/veil
   cd /opt/veil
   npm ci
   npm run build
   ```
2. Create storage directory and user:
   ```bash
   sudo useradd -r -s /bin/false veil
   sudo mkdir -p /var/lib/veil/storage
   sudo chown -R veil:veil /var/lib/veil/storage
   ```
3. Install systemd service:
   ```bash
   sudo cp deployment/systemd/veil-relay.service.example /etc/systemd/system/veil-relay.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now veil-relay
   ```
4. Verify status:
   ```bash
   sudo systemctl status veil-relay
   ```

### Option 2: Reverse Proxy Setup (Caddy)
```bash
sudo cp deployment/Caddyfile.example /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Option 3: Docker & Docker Compose
```bash
cd deployment/docker
docker compose up -d
```

---

## 🩺 Health Checks & Keep-Alive Monitoring

The relay server exposes lightweight liveness and readiness endpoints:

- **`GET /health`** (or `GET /healthz`): Non-blocking liveness probe returning `{"status":"ok", "protocolVersion":"v1", "uptimeSeconds": ...}`. Requires no authentication, performs zero DB/storage I/O, and is suitable for load balancer health checks and external keep-alive pings (e.g. 10-minute ping intervals for PaaS environments like Render).
- **`GET /readyz`**: Comprehensive readiness probe checking storage and database dependencies.

---

## 🔒 Security Best Practices
- Always terminate TLS upstream using TLS 1.3.
- Never expose raw HTTP/WS endpoints directly to the public Internet without TLS.
- Keep `RELAY_STORAGE_DIR` on a secure, encrypted filesystem partition (LUKS).

