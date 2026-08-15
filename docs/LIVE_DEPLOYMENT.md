# Live Server Deployment Runbook

## 1. Server Architecture

```
[ Public Internet ] ──HTTPS/WSS──> [ Caddy / Nginx Reverse Proxy (TLS 1.3) ]
                                                │ (127.0.0.1:8787)
                                                ▼
                                    [ VEIL Relay Server Daemon ]
                                                │
                                                ▼
                                    [ Atomic File Relay Store ]
```

---

## 2. Step-by-Step Deployment

```bash
# 1. Clone repository to /opt/veil
git clone https://github.com/veil/veil.git /opt/veil
cd /opt/veil

# 2. Install dependencies & build
npm ci
npm run build

# 3. Setup Systemd Service
sudo cp deployment/systemd/veil-relay.service.example /etc/systemd/system/veil-relay.service
sudo systemctl daemon-reload
sudo systemctl enable --now veil-relay

# 4. Verify Health
curl -k https://127.0.0.1:8787/health
```
