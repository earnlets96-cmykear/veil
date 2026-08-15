# NETWORK_ARCHITECTURE.md — Client Networking Architecture & Subsystems

## 1. Overview

The VEIL client networking subsystem (`src/network/`) connects local Space messaging engines to the untrusted blind relay network over HTTP and WebSocket.

```
┌─────────────────────────────────────────────────────────────┐
│                       LOCAL SPACE BOUNDARY                  │
│                                                             │
│  ┌─────────────────────────┐     ┌───────────────────────┐  │
│  │ ConversationManager /   │     │  EncryptedSpaceStore  │  │
│  │ GroupManager (E2EE)     │     │  (StorageKey Derived) │  │
│  └────────────┬────────────┘     └───────────▲───────────┘  │
│               │ E2EE Ciphertext              │ Encrypted    │
│               ▼                              │ Queues       │
│  ┌───────────────────────────────────────────┴───────────┐  │
│  │                    NetworkManager                     │  │
│  │                                                       │  │
│  │  ┌────────────────────┐      ┌─────────────────────┐  │  │
│  │  │   EnvelopeQueue    │      │ SpaceMailboxBinding │  │  │
│  │  │ (Outbound/Inbound) │      │ (Opaque Capability) │  │  │
│  │  └────────────────────┘      └─────────────────────┘  │  │
│  └────────────┬──────────────────────────────┬───────────┘  │
└───────────────┼──────────────────────────────┼──────────────┘
                │ HTTP REST                    │ WebSocket Push
                ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 UNTRUSTED BLIND RELAY SERVER                │
│             (Opaque Envelopes & Routing Only)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Key Components

1. **`NetworkManager`**: Central orchestrator managing active Space network sessions.
2. **`EnvelopeQueue`**: Persistent encrypted outbound and inbound queues backed by `EncryptedSpaceStore` (IndexedDB).
3. **`HttpTransport`**: Typed REST client for mailbox allocation, envelope submission, polling fetch, and ACKs.
4. **`WebSocketTransport`**: Real-time push channel with automated exponential backoff reconnects and ping/pong heartbeats.
5. **`SpaceMailboxBinding`**: Stores opaque mailbox identifier and secret capability token encrypted under the Space's derived `StorageKey`.
