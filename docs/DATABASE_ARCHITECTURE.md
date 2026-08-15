# DATABASE_ARCHITECTURE.md — Client & Relay Database Storage Boundaries

## 1. Storage Boundaries Overview

VEIL separates client-side local storage from server-side relay storage:

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT STORAGE                         │
│                    (IndexedDB / Browser)                    │
│                                                             │
│  - SpaceHeaderEnvelopes (Argon2id + XChaCha20-Poly1305)     │
│  - Encrypted Application Records (StorageKey Partition)     │
│  - Encrypted Outbound & Inbound Message Queues              │
│  - Space-Isolated Contacts & Identities                     │
│  - ZERO Plaintext Persisted                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                      [Blind Network]
                              │
┌─────────────────────────────────────────────────────────────┐
│                      RELAY STORAGE                          │
│               (PersistentFileRelayStore)                    │
│                                                             │
│  - Opaque RelayEnvelopes (Ciphertext Only)                  │
│  - Mailbox Records (SHA-256 Capability Hashes)              │
│  - Expiration Timestamps (TTL GC)                           │
│  - ZERO Passwords, ZERO Keys, ZERO Plaintext Messages       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Retention & Deletion

- **Client Storage**: Managed under user control; individual records or entire Spaces can be deleted or wiped.
- **Relay Storage**: Envelopes automatically expire after TTL (default 14 days) and are swept periodically by `sweepExpired()`.
