# CLIENT_RELAY_INTEGRATION.md — Client E2EE & Relay Integration Guide

## 1. Outbound E2EE Pipeline

When Alice sends a message to Bob:
1. `ConversationManager.sendMessage()` encrypts the plaintext using the active Double Ratchet session under `XChaCha20-Poly1305` and advances the DH ratchet state.
2. The resulting E2EE ciphertext and ratchet header are serialized to Base64.
3. `NetworkManager.sendEnvelope()` wraps the ciphertext into a transport payload addressed to Bob's blind `mailboxId`.
4. The envelope is enqueued into Alice's encrypted outbound queue (`EnvelopeQueue`).
5. `HttpTransport.sendEnvelope()` posts the envelope to the relay (`POST /v1/envelopes`).
6. Upon HTTP 201 Created from the relay, the envelope is removed from the local outbound queue.

---

## 2. Inbound E2EE Pipeline & ACK-After-Persistence

When Bob receives an envelope from the relay:
1. The envelope arrives via WebSocket push or HTTP fetch.
2. `EnvelopeQueue.enqueueInbound()` checks for duplicates. If duplicate, ACK is sent and processing stops.
3. If new, the envelope is stored in the local encrypted inbound queue.
4. The opaque payload is dispatched to `ConversationManager.receiveMessage()`.
5. Double Ratchet validates header and AEAD authentication tag, advances ratchet, and recovers plaintext.
6. The decrypted message is committed to local Space store.
7. Only after successful processing and persistence, an ACK is transmitted to the relay (`POST /v1/envelopes/ack` or WebSocket ACK).
8. The relay deletes the envelope.
