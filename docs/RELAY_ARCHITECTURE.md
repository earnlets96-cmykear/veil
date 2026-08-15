# RELAY_ARCHITECTURE.md — VEIL Relay Architecture & Delivery Semantics

## 1. System Topology

```
                      ┌────────────────────────────────────────┐
                      │          VEIL UNTRUSTED RELAY          │
                      │                                        │
                      │  ┌──────────────┐   ┌───────────────┐  │
                      │  │  HTTP Router │   │  WebSocket    │  │
                      │  │  (/v1/...)   │   │  Handler      │  │
                      │  └──────┬───────┘   └───────┬───────┘  │
                      │         │                   │          │
                      │  ┌──────▼───────────────────▼───────┐  │
                      │  │          IRelayStore             │  │
                      │  │ (Blind Mailboxes & Opaque Envs)  │  │
                      │  └──────────────────────────────────┘  │
                      └──────────────────▲─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
        Opaque Ciphertext Envelopes                      Opaque Ciphertext Envelopes
                 │                                               │
      ┌──────────┴──────────┐                         ┌──────────┴──────────┐
      │   Client A (Alice)  │                         │    Client B (Bob)   │
      │ ┌─────────────────┐ │                         │ ┌─────────────────┐ │
      │ │  Double Ratchet │ │                         │ │  Double Ratchet │ │
      │ │ E2EE Encryption │ │                         │ │ E2EE Decryption │ │
      │ └─────────────────┘ │                         │ └─────────────────┘ │
      └─────────────────────┘                         └─────────────────────┘
```

---

## 2. Delivery Semantics: At-Least-Once Delivery

VEIL adopts **at-least-once delivery semantics** over untrusted transport:
1. When an envelope is submitted, it is enqueued in the target mailbox.
2. The recipient fetches envelopes (via HTTP polling or WebSocket push).
3. The recipient client processes and decrypts the envelope locally.
4. The recipient issues an explicit `POST /v1/envelopes/ack` request.
5. Upon receiving valid ACK authorized by the mailbox capability, the relay permanently deletes the envelope.
6. If a client disconnects before ACK, the envelope remains in the mailbox until fetched again or TTL expires.

Duplicate delivery is handled safely at the client's cryptographic layer (`ConversationManager` / `GroupManager` message index deduplication).

---

## 3. Resource Bounds & Quotas

To prevent resource exhaustion attacks:
- **Maximum Envelope Size**: 65,536 bytes (64 KiB).
- **Maximum Envelopes per Mailbox**: 1,000 envelopes.
- **Maximum Envelope TTL**: 14 days (default: 7 days).
- **Maximum Mailbox TTL**: 90 days (default: 30 days).
- **Rate Limits**: 120 requests/minute per IP address.
- **WebSocket Limits**: Max 20 concurrent connections per IP.
- **Backpressure**: 1 MB socket send buffer limit.
