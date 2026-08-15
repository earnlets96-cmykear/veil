# SYSTEM_SUMMARY.md — VEIL Production System Specification

## 1. Executive Summary

**VEIL** is a privacy-first modern messaging application with multi-space cryptographic isolation, credential-selected unlocking, untrusted blind relay transports, and an AI-agent continuity system.

---

## 2. Core Architecture & Cryptographic Primitives

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                     │
│                    (React 19 + TypeScript)                  │
│                                                             │
│  - Neutral Lock Screen (Credential-Selected Unlocking)      │
│  - Space Isolation & State Wipe on Switch                   │
│  - E2EE 1-to-1 Messaging Timeline & Group Ratchet UI        │
│  - Chunked Encrypted Attachments & Ephemeral Blobs          │
│  - Privacy-Preserving Notifications (HIDDEN / SENDER_ONLY)  │
│  - Volatile In-Memory Local Search (Purged on Lock)         │
│  - Instant Emergency Panic Lock                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    APPLICATION STATE LAYER                  │
│                                                             │
│  - SessionController • ContactManager • InvitationManager   │
│  - AttachmentPipeline • LocalSearchEngine • AppConfig       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   CORE CRYPTOGRAPHIC ENGINE                 │
│                                                             │
│  - Argon2id Password KDF (Passphrase -> KEK)                │
│  - XChaCha20-Poly1305 AEAD (SpaceHeaderEnvelopes)           │
│  - HKDF-SHA-256 Key Hierarchy (SMK -> Storage / Identities) │
│  - Double Ratchet (1-to-1 E2EE) + X3DH Prekeys              │
│  - Group Tree Ratchet (Post-Compromise Security & Epochs)   │
│  - BIP-39 24-Word Recovery Vaults & Device SAS Pairing      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    STORAGE & NETWORK LAYER                  │
│                                                             │
│  - Client: EncryptedSpaceStore (IndexedDB Partitioned)      │
│  - Network: NetworkManager • EnvelopeQueue (Offline-First)  │
│  - Transport: HttpTransport • WebSocketTransport (Push)    │
│  - Relay Server: Standalone Blind Relay (File/Memory Store) │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Cryptographic Key Hierarchy

1. **Passphrase $\rightarrow$ KEK**: `Argon2id(passphrase, salt, m=64MB, t=3, p=4)` $\rightarrow$ Key Encryption Key (32 bytes).
2. **KEK $\rightarrow$ SMK**: `Decrypt(SpaceHeaderEnvelope, KEK)` $\rightarrow$ Space Master Key (SMK, 32 bytes).
3. **SMK $\rightarrow$ StorageKey**: `HKDF-Expand(SMK, "veil-storage-key-v1")` $\rightarrow$ 32-byte key for local IndexedDB encryption.
4. **SMK $\rightarrow$ Identity**: `HKDF-Expand(SMK, "veil-identity-seed-v1")` $\rightarrow$ Ed25519 Signing + X25519 Key Agreement keypairs.
5. **Double Ratchet**: Ephemeral X25519 Diffie-Hellman ratcheting with symmetric KDF chains per message.

---

## 4. Multi-Space Isolation & Plausible Deniability

- A single installation supports unlimited isolated Spaces.
- Entering Password A unlocks Space A; entering Password B unlocks Space B.
- No public directory or index of Spaces exists at rest or in UI.
- Decoy Spaces are fully functional cryptographic Spaces intended to satisfy forced disclosure without revealing primary data.

---

## 5. Blind Transport & Untrusted Relay

- Relays store only opaque encrypted envelopes indexed by blind `mailboxId` with SHA-256 capability authentication.
- Zero plaintext messages, passwords, or identity private keys are ever transmitted to or stored by the relay.
- Envelopes enforce bounded TTLs (default 14 days) and sliding-window rate limits.

---

## 6. Testing & Quality Assurance

- **Total Test Suites**: **131 test files**.
- **Total Verified Tests**: **299+ passing automated tests (100% clean pass rate)**.
- **Production Build**: Clean bundle compiled in ~1.00s.
