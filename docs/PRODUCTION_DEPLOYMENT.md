# PRODUCTION_DEPLOYMENT.md — VEIL Production Deployment & Self-Hosting Guide

## 1. Relay Server Self-Hosting (Free & Open Source)

VEIL's relay server can be self-hosted on any Linux/FreeBSD/macOS/Windows server with Node.js 20+:

```bash
# Start standalone relay with persistent filesystem storage
export RELAY_STORAGE_DIR="/var/lib/veil-relay"
export RELAY_PORT="8787"
npm run relay
```

---

## 2. Reverse Proxy & TLS Configuration (Nginx / Caddy)

```nginx
server {
    server_name relay.veil.chat;
    listen 443 ssl http2;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```
