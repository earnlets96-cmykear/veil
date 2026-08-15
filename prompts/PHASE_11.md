# PHASE 11: Production Interactive UI, Persistent Storage & Standalone Relay Server

## 1. Objective

Build the complete, production-grade **Interactive User Experience Layer**, **Persistent Client Storage**, and **Standalone Relay Server Daemon** on top of VEIL's verified and frozen cryptographic core (Phases 0–10).

---

## 2. Core Deliverables

### A. Full Interactive React Application (`src/ui/`)
1. **Multi-Space Unlock & Authentication**:
   - Credential-selected unlocking with smooth transitions.
   - Space creation modal (Main, Work, Private, Decoy Space).
2. **Messenger Workspace**:
   - **Sidebar**: Conversations list (Direct Chats & Groups), unread counters, search filter.
   - **1-to-1 Chat View**: Real-time E2EE messaging via Double Ratchet, safety number verification modal.
   - **Group Chat View**: Multi-party SenderKey messaging, role chips, member drawer, epoch rotation alerts.
   - **Encrypted Media Experience**: 64 KiB chunked image and document encryption, in-memory preview, download.
   - **Linked Devices & SAS**: QR enrollment ticket display, 6-digit SAS verification simulator, device revocation.
   - **Recovery & Backup**: 24-word BIP-39 mnemonic phrase viewer, `.veilbackup` file export/import.
   - **Privacy Controls**: Quick Lock, Instant Panic Lock, Auto-lock timer settings, Notification privacy modes.

### B. Persistent Client Storage Adapter (`src/storage/indexedDbAdapter.ts`)
- Backs `EncryptedSpaceStore` and `SpaceVaultManager` with browser IndexedDB.
- Guaranteed client-side AEAD encryption before writing to IndexedDB; zero plaintext keys or messages on disk.

### C. Standalone Production Relay Server (`src/server/relayServer.ts`)
- Standalone Node.js HTTP/WebSocket relay daemon.
- Implements blind capability mailboxes, 64 KiB size class enforcement, and TTL garbage collection sweeps.

---

## 3. Security & Governance Invariants

1. **Strict Post-RC Security Freeze**: Do NOT modify frozen cryptographic algorithms in `src/crypto/`, `src/spaces/`, `src/ratchet/`, `src/group/`, or `src/identity/`.
2. **Zero Plaintext Leakage**: Decrypted media and session keys remain strictly in volatile memory.
3. **100% Test Integrity**: All existing 91 test suites must continue to pass cleanly.
