# VEIL Production Deployment Guide

## 1. Overview

VEIL is designed for modern zero-trust deployment environments. The web client compiles to a static distribution bundle (`dist/`), while the Blind Relay Server runs as a standalone daemon.

---

## 2. Recommended Production Topology

```
[ Internet Clients ]
        │
        ▼ (HTTPS :443 / WSS)
[ Caddy / Nginx Reverse Proxy ]
        │
        ▼ (HTTP :8787 / WS)
[ VEIL Blind Relay Daemon ]
        │
        ▼ (Atomic File I/O)
[ Encrypted Storage Partition (/var/lib/veil/storage) ]
```

---

## 3. Step-by-Step Deployment

1. **Build Client Bundle**:
   ```bash
   npm ci
   npm run build
   ```
2. **Serve Static Web UI**:
   - Host `dist/` using any static file web server (Caddy, Nginx, Cloudflare Pages).
3. **Run Relay Server**:
   - Use the provided systemd service (`deployment/systemd/veil-relay.service.example`) or Docker container (`deployment/docker/`).
4. **Configure DNS & TLS**:
   - Ensure the relay domain has valid TLS 1.3 certificates terminating at the reverse proxy.
