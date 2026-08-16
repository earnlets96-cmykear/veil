# CLIENT_RELAY_INTEGRATION.md — Client E2EE & Relay Integration Guide

## 1. Outbound E2EE Pipeline

When Alice sends a message to Bob:
1. `AppState.sendMessage()` resolves Bob's `Contact` record containing Bob's blind `mailboxId` and public `PrekeyBundle`.
2. `ConversationManager.encryptAndPackWireMessage()` encrypts the plaintext using the active Double Ratchet session under `XChaCha20-Poly1305` (initializing via X3DH if first message), packages into `WirePayload` with authenticated sender document, and applies size-class padding (`padPayload`).
3. `NetworkManager.sendEnvelope()` places the size-padded ciphertext envelope into the Space's persistent outbound queue (`EnvelopeQueue`).
4. `HttpTransport.sendEnvelope()` posts the envelope to the relay targeting Bob's blind mailbox (`POST /v1/envelopes`).
5. Upon HTTP 201 Created from the relay, the envelope is removed from the local outbound queue.

---

## 2. Inbound E2EE Pipeline & ACK-After-Persistence

When Bob receives an envelope from the relay:
1. The envelope arrives via WebSocket real-time push or HTTP fetch catch-up sync.
2. `EnvelopeQueue.enqueueInbound()` checks for duplicates. If duplicate, ACK is sent immediately and processing stops.
3. If new, the envelope is persisted in the local encrypted inbound queue.
4. The opaque wire payload is dispatched to `ConversationManager.processInboundWirePayload()`.
5. The payload is unpadded, Bob's Double Ratchet session is initialized via `receiveX3DH` (if initial message) or advanced, and the plaintext is recovered.
6. The decrypted message is committed to local Space store under the sender's conversation ID.
7. Only after successful local persistence and decryption, an ACK is transmitted to the relay (`POST /v1/envelopes/ack` or WebSocket ACK).
8. The relay deletes the envelope.
