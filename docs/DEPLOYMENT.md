# DEPLOYMENT.md — Production Server Deployment & Hardening Guide

## 1. Deployment Architecture

VEIL relies on an **untrusted blind relay transport** model. The server acts strictly as an ephemeral storage substrate for opaque transport envelopes and capability-authenticated mailboxes.

```
Internet / Clients
       │
       ▼ (TLS 1.3 only, Strict HSTS, TLS ALPN)
┌──────────────────────────────────────┐
│  Reverse Proxy (Nginx / Envoy / Caddy)│
└──────────────────┬───────────────────┘
                   │ (HTTP/2 / WebSocket / gRPC)
┌──────────────────▼───────────────────┐
│  VEIL Blind Transport Relay Node     │
│  • Blind Mailboxes & Capability Auth │
│  • Strict Size Class Validation      │
│  • Memory/Disk TTL Queue (Max 14d)   │
└──────────────────────────────────────┘
```

---

## 2. Server Hardening Checklist

- [ ] **TLS 1.3 Only**: Enforce modern cipher suites (`TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`).
- [ ] **Strict Logging Policy**: Configure reverse proxy and relay server to **NEVER** log request bodies, payload contents, or capability authorization tokens.
- [ ] **Short Envelope TTL**: Enforce maximum storage retention on blind envelopes (default: 7 days, maximum: 14 days). Expired envelopes are purged automatically.
- [ ] **Rate Limiting**: Apply connection rate limiting and mailbox creation limits per source IP (`100 req/min` default).
- [ ] **Least Privilege Execution**: Run relay processes under unprivileged service users (`veil-relay:veil-relay`) in isolated Docker/Podman containers.
- [ ] **Firewall**: Expose only port `443` (HTTPS/WSS). Close all debug/admin ports to the public internet.

---

## 3. Environment Configuration

See [`.env.example`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/.env.example) for available deployment parameters:

```bash
# Network & Server Binding
VEIL_ENV=production
VEIL_HOST=0.0.0.0
VEIL_PORT=8443

# Envelope Storage & TTL
VEIL_MAX_ENVELOPE_TTL_SECONDS=604800   # 7 days
VEIL_MAX_MAILBOX_ENVELOPES=1000        # Max queued per mailbox
VEIL_MAX_PAYLOAD_BYTES=65536           # 64 KiB strict cap

# Rate Limiting
VEIL_RATE_LIMIT_BURST=100
VEIL_RATE_LIMIT_WINDOW_SECONDS=60
```

---

## 4. Container Deployment (Docker / Compose)

```yaml
version: '3.8'
services:
  veil-relay:
    image: veil-project/veil-relay:v1.0.0-rc.1
    restart: always
    user: "10001:10001"
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64M
    environment:
      - VEIL_ENV=production
      - VEIL_PORT=8443
    ports:
      - "127.0.0.1:8443:8443"
    security_opt:
      - no-new-privileges:true
```
