# Phase 31: Production Connectivity, Cloud Infrastructure & Mobile Diagnostics

## 1. Architectural Summary & Endpoints

| Resource | Canonical Active Configuration | Future Custom Domain |
|---|---|---|
| **Production Backend** | Render Web Service | Custom domain alias |
| **HTTP Base URL** | `https://veil-rga0.onrender.com` | `https://relay.veil.chat` |
| **WebSocket URL** | `wss://veil-rga0.onrender.com/v1/ws` | `wss://relay.veil.chat/v1/ws` |
| **Relational DB** | Supabase PostgreSQL (via `DATABASE_URL`) | Same |
| **Object/Attachment Store** | Cloudflare R2 SigV4 (via `R2_*`) | Same |

---

## 2. Root Cause Analysis of Previous Android Error

### The Symptom:
On Android, the app failed with:
`"Failed to connect to relay server at https://relay.veil.chat/v1/mailboxes: Failed to fetch"`
and entered `"Degraded (Polling)"` state.

### The Root Cause:
1. `https://veil-rga0.onrender.com` is **live, healthy, and verified** with active Supabase PostgreSQL and Cloudflare R2 connections.
2. The domain `relay.veil.chat` had **no active DNS record** (`dial tcp: lookup relay.veil.chat: no such host`).
3. The client configuration had hardcoded `https://relay.veil.chat` as default in `appConfig.ts`, causing mobile and web clients without query overrides to fail DNS resolution immediately.

### Remediation:
1. Updated `src/config/appConfig.ts` to use `https://veil-rga0.onrender.com` and `wss://veil-rga0.onrender.com/v1/ws` as canonical production defaults.
2. Supported `VITE_RELAY_URL` and `VITE_RELAY_WS_URL` for build-time overrides.
3. Supported runtime overrides via `?relay=` query parameter and local storage key `veil_custom_relay_url`.
4. Fully tested and verified all 16 live endpoints on `https://veil-rga0.onrender.com` via [`scripts/phase31-production-connectivity.mjs`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/scripts/phase31-production-connectivity.mjs).

---

## 3. Custom Domain Setup (When Desired)
To route `https://relay.veil.chat` $\to$ `https://veil-rga0.onrender.com`:

1. In Cloudflare / DNS Provider for `veil.chat`:
   - Type: `CNAME`
   - Name: `relay`
   - Target: `veil-rga0.onrender.com`
   - Proxy status: DNS Only or Proxied (with WebSocket enabled).
2. In Render Dashboard (`veil-rga0` Web Service $\to$ Settings $\to$ Custom Domains):
   - Add `relay.veil.chat` and wait for automatic Let's Encrypt certificate issuance.
3. Update build environment variable `VITE_RELAY_URL=https://relay.veil.chat`.

---

## 4. Live Verification Results (Render + Supabase + Cloudflare R2)

Running `npx tsx scripts/phase31-production-connectivity.mjs --target https://veil-rga0.onrender.com`:

```
================================================================
🌐 VEIL PHASE 31 REAL PRODUCTION CONNECTIVITY & CLOUD SMOKE TEST
🎯 Target Endpoint: https://veil-rga0.onrender.com
⚡ WebSocket Endpoint: wss://veil-rga0.onrender.com/v1/ws
================================================================

[1/16] Testing DNS & Network Reachability...
  PASSED: Server responded (HTTP 404)
[2/16] Testing HTTPS TLS Enforcement...
  PASSED: HTTPS TLS protocol active
[3/16] Testing GET /health endpoint...
  PASSED: Health check ok (status=ok, uptime=626s)
[4/16] Testing GET /readyz readiness endpoint...
  PASSED: Readiness check ok (status=ready, cloudDb=ok)
[5/16] Testing CORS OPTIONS preflight...
  PASSED: CORS headers valid (origin: *)
[6/16] Testing API /v1/mailboxes connectivity...
  PASSED: Blind mailbox allocated
[7/16] Testing Supabase PostgreSQL connectivity...
  PASSED: Supabase PostgreSQL connected and active
[8/16] Testing Cloudflare R2 object storage connectivity...
  PASSED: Cloudflare R2 S3 storage connected and active
[9/16] Testing Zero-Knowledge Account Registration...
  PASSED: Account registered in Supabase
[10/16] Testing Mailbox Capability Token Validation...
  PASSED: Mailbox capability token verified
[11/16] Testing Envelope Persistence on Relay...
  PASSED: Envelope pushed and fetched successfully
[12/16] Testing Encrypted Attachment Upload to Cloudflare R2...
  PASSED: Attachment uploaded to R2
[13/16] Testing Encrypted Attachment Download & AEAD Decryption...
  PASSED: Attachment downloaded and decrypted with authenticated integrity
[14/16] Testing Unauthorized Attachment Rejection...
  PASSED: Unauthorized access rejected (404/403 Access Denied)
[15/16] Testing Zero-Knowledge Account Recovery Endpoint...
  PASSED: Zero-knowledge recovery returned matching account record
[16/16] Testing WebSocket /v1/ws Connectivity...
  PASSED: WebSocket connected and received pong

================================================================
SMOKE TEST RESULTS: 16/16 checks PASSED (100%)
================================================================
🎉 ALL PRODUCTION CONNECTIVITY CHECKS PASSED FULLY!
```
