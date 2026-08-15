# OFFLINE_DELIVERY.md — Offline Messaging, Queueing & Reconnection Recovery

## 1. Offline-First Messaging Architecture

VEIL is fully functional while offline:
- When a user sends a message while offline or network is degraded:
  1. The message is encrypted locally using Double Ratchet.
  2. The encrypted envelope is persisted to the Space's encrypted outbound queue (`EncryptedSpaceStore`).
  3. Plaintext is immediately purged from volatile memory.
- When network connectivity is restored:
  1. `NetworkManager.flushOutboundQueue()` automatically drains pending envelopes with bounded concurrency.
  2. Status transitions from `QUEUED` $\rightarrow$ `SENDING` $\rightarrow$ `SENT_TO_RELAY`.

---

## 2. Application Restart Recovery

If the application closes or crashes while messages are pending in the outbound queue:
1. On next launch and Space unlock, `EnvelopeQueue.listOutbound()` discovers persisted envelopes.
2. The network manager resumes draining automatically without requiring the user to retype messages or re-encrypt plaintexts.

---

## 3. Duplicate Delivery Tolerance

Because the relay guarantees **at-least-once delivery**, duplicate deliveries can occur if an ACK packet is lost during network disruption.
- `EnvelopeQueue` maintains a rolling deduplication cache (`net_processed_envelope_ids`).
- If an envelope with an already processed `envelopeId` arrives, the client suppresses duplicate processing and immediately ACKs the relay so the server drops the duplicate.
