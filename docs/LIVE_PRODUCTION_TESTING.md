# Live Production Relay Deployment & Testing

## 1. Starting the Standalone Relay Server

```bash
# Start relay daemon on port 8787
npm run relay
```

---

## 2. Testing Live Connectivity

```bash
# Run automated live relay check against deployed endpoint
VEIL_LIVE_RELAY_URL=https://relay.yourdomain.com node scripts/phase21-live-relay-check.mjs
```

### Verified Behaviors
- **Health Check (`GET /health`)**: Verifies HTTP 200 OK.
- **Mailbox Creation (`POST /v1/mailboxes`)**: Allocates ephemeral mailbox.
- **Ciphertext Submission (`POST /v1/send`)**: Accepts opaque Base64 envelope.
- **Envelope Fetch & ACK (`GET /v1/fetch` & `POST /v1/ack`)**: Retrieves envelope and purges from relay storage.
