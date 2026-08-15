# PHASE 03: Privacy-Preserving Untrusted Transport Interface

## Objective
Implement the decoupled `ITransportAdapter` interface and an untrusted local relay server using blind mailbox routing tokens to prevent social graph leakage.

## Requirements
1. **Transport Abstraction**: Define `ITransportAdapter` supporting WebSocket, HTTP, and mock local transports.
2. **Blind Mailbox Tokens**: Derive destination mailboxes as `HMAC-SHA256(RecipientPrekey, Token)` unlinked to user identities.
3. **Untrusted Relay Server**: Implement lightweight Node.js/WebSocket relay that stores and routes blind ciphertext envelopes without maintaining user accounts or social graphs.
4. **Offline Queuing**: Support blind store-and-forward mailbox delivery for offline recipients.
5. **Adversarial Relay Verification**: Verify that inspecting server logs or database dumps yields zero plaintext, zero user IDs, and zero communication graphs.

## Definition of Done
- Multi-client transport communication working over local relay.
- Adversarial tests confirm server has zero access to message plaintext or social graph.
