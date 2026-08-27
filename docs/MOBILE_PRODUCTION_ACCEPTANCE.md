# Mobile Production Acceptance & Verification Guide

## 1. Automated Acceptance Harness
The Phase 31 acceptance harness ([`scripts/phase31-mobile-production-acceptance.mjs`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/scripts/phase31-mobile-production-acceptance.mjs)) executes 10 end-to-end integration and cloud continuity checks:

| Check | Objective | Verification Method |
|---|---|---|
| **[1/10] Production Health** | `/health` responds with database connection | HTTP GET `/health` returns `200 { status: 'ok', database: 'connected' }` |
| **[2/10] Production Readiness** | `/readyz` responds with storage and cloud DB readiness | HTTP GET `/readyz` returns `200 { status: 'ready', cloudDb: 'ok' }` |
| **[3/10] Account Registration** | Argon2id zero-knowledge account creation | POST `/v1/account/register` produces valid account and device session |
| **[4/10] Persistent Account Lookup** | Database query for registered account | Database record verification in cloud DB |
| **[5/10] Directory/Profile Persistence** | Signed Ed25519 profile publication & search | Directory registration and prefix search |
| **[6/10] Blind Mailbox Persistence** | Mailbox allocation with SHA-256 capability hash | POST `/v1/mailboxes` creates 201 response with capabilityToken |
| **[7/10] Attachment Persistence** | Client-side XChaCha20-Poly1305 encrypted attachments | Upload, download, hash check, and authenticated decryption |
| **[8/10] Unauthorized Attachment Rejection** | Multi-tenant zero-knowledge access control | Unauthenticated client receives 403/404 on attachment download |
| **[9/10] Identity Recovery** | Deterministic identity recovery on clean device | Reconstructs exact `identityId` byte-for-byte |
| **[10/10] Cold Backend Restart** | Server crash/restart state survival | Process kill, reload from disk, full health and account verification |

## 2. Running Acceptance Checks
```bash
npx tsx scripts/phase31-mobile-production-acceptance.mjs
```
Expected output:
```
================================================================
ACCEPTANCE RESULTS: 10/10 checks PASSED (100%)
================================================================
🎉 ALL PHASE 31 MOBILE ACCEPTANCE CRITERIA PASSED FULLY!
```
