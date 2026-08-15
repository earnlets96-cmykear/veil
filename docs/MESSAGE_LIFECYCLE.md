# MESSAGE_LIFECYCLE.md — VEIL Production Message State Machine & Pipeline

## 1. End-to-End State Machine

Every message follows a deterministic state machine:

```
[ DRAFT ]
   │
   ▼
[ QUEUED ] (Persisted encrypted locally in EnvelopeQueue)
   │
   ▼
[ SENDING ] (Transmitting encrypted envelope to relay)
   │
   ▼
[ SENT_TO_RELAY ] (Relay accepted envelope into recipient mailbox)
   │
   ▼
[ DELIVERED_TO_RECIPIENT ] (Recipient downloaded, decrypted & ACKed)
   │
   ▼
[ FAILED ] (Exceeded retry attempts or fatal network rejection)
```

---

## 2. Integrity & Persistence Invariants

- **Pre-Flight Encryption**: Messages are encrypted via Double Ratchet *before* being placed into the persistent outbound queue.
- **ACK-After-Persistence**: Inbound envelopes are committed to encrypted storage before sending an ACK to the relay.
- **Deduplication**: Inbound message IDs are deduplicated against a rolling cache to prevent double-processing.
