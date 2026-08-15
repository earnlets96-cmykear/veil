# VEIL Self-Hosting Guide

## 1. Principles of Self-Hosting VEIL

- **100% Free & Open-Source**: Zero paid cloud dependencies, zero vendor lock-in.
- **Untrusted Blind Relay**: The relay host operators cannot read messages, decrypt attachments, or determine user social graphs.
- **Minimal Resource Requirements**: A minimal VPS (1 vCPU, 512 MB RAM, 10 GB Disk) can comfortably support hundreds of active blind mailboxes.

---

## 2. Quick Setup

```bash
# 1. Clone repository
git clone https://github.com/your-repo/veil.git /opt/veil
cd /opt/veil

# 2. Install dependencies and build
npm ci
npm run build

# 3. Launch relay daemon
RELAY_PORT=8787 RELAY_HOST=0.0.0.0 npm run relay
```

---

## 3. Reverse Proxy Configuration

Copy [`deployment/Caddyfile.example`](../deployment/Caddyfile.example) to `/etc/caddy/Caddyfile` and reload Caddy to enable automatic Let's Encrypt certificates and WebSocket forwarding.
