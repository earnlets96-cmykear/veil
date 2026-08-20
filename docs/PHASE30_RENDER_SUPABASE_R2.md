# Phase 30: Render + Supabase PostgreSQL + Cloudflare R2 Production Persistence

## Overview

Phase 30 establishes production-grade, zero-knowledge durable cloud persistence for VEIL, transitioning the platform from ephemeral/in-memory test topologies to resilient distributed infrastructure:

1. **Relational Database**: Supabase PostgreSQL (`postgresClient.ts`, `sqlCloudDatabase.ts`, `postgresRelayStore.ts`).
2. **Object Storage**: Cloudflare R2 (`s3ObjectStorage.ts`, S3 API v4 compatible).
3. **Application Backend**: Render Web Service (`render.yaml`, Node.js / TypeScript relay server).

---

## Architecture Topology

```
┌─────────────────────────────────────────────────────────────┐
│                      VEIL Web & Android                     │
│         (Local Encrypted Partition Store & Space Vault)     │
└──────────────┬───────────────────────────────┬──────────────┘
               │ HTTPS / WSS                   │ HTTPS / WSS
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Render Stateless Relay Node                 │
│         (Node.js / Express / ws - Zero Local State)         │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Parameterized SQL             │ S3 API v4 (AWS SigV4)
               ▼ (Connection Pooling & SSL)    ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Supabase PostgreSQL     │ │       Cloudflare R2        │
│  - accounts                  │ │  - attachments/{objectId}  │
│  - devices                   │ │  - voice/{objectId}        │
│  - spaces                    │ │  - backups/{backupId}      │
│  - messages                  │ │                            │
│  - attachments               │ │                            │
│  - recovery_state            │ │                            │
│  - relay_mailboxes           │ │                            │
│  - relay_envelopes           │ │                            │
│  - directory_profiles        │ │                            │
│  - contact_requests          │ │                            │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## Core Security Invariants

1. **Stateless Relay**: The Render instance local disk is strictly treated as volatile. All accounts, device registrations, encrypted Space headers, ratchet messages, and directory entries are stored exclusively in Supabase PostgreSQL; all audio and attachments are stored exclusively in Cloudflare R2.
2. **Zero Plaintext Ingestion**: The database and object store only ever receive hashes, nonces, and authenticated ciphertexts (XChaCha20-Poly1305 / Argon2id / Ed25519).
3. **Multi-Tenant Access Authorization**: Attachment downloads verify that the requesting account is either the uploader, an explicitly authorized recipient (`recipientAccountId`), or an authorized conversation participant.
4. **Deterministic Identity Restoration**: Account recovery via BIP-39 mnemonic phrase derives the exact Space Master Key byte-for-byte, preserving identity continuity and public key bindings without ever generating new keys upon re-installation.
