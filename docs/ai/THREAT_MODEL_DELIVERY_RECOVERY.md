# Threat Model: Inbound Delivery Recovery

## Scope

This review covers the client-side inbox lifecycle in `NetworkManager`, `EnvelopeQueue`, and the AppState inbound handler. The relay protocol, mailbox authorization, ciphertext format, ratchet, and cryptographic primitives are unchanged.

## Assets and trust boundaries

- The relay stores opaque ciphertext and is untrusted for message confidentiality or integrity.
- The client persists inbound ciphertext and processed envelope IDs inside the active Space's encrypted store.
- The active Space's existing Double Ratchet and conversation history remain the authority for authenticating and storing message content.

## Failure and abuse cases

1. **Processing failure followed by premature relay ACK**: the server deletes the only copy while the local queue stays unprocessed. Mitigation: do not ACK pending rows; retry them during mailbox sync and re-entry.
2. **Concurrent sync/WebSocket delivery**: two handlers could process the same ratchet envelope concurrently. Mitigation: serialize processing by envelope ID in the active NetworkManager instance and re-check the encrypted processed-ID registry.
3. **Undecryptable payload reported as handled**: a swallowed decryption error could cause an ACK. Mitigation: only use the existing legacy JSON fallback when the payload matches its supported message shape; otherwise propagate the error and leave it pending.
4. **Replay or duplicate relay delivery**: a processed message could be shown twice. Mitigation: the existing processed-ID registry suppresses replay and permits safe ACK of already-processed envelopes.

## Residual risks and release gates

- The delivery callback and encrypted queue are separate persistence operations; a process crash between them can cause a retry after the ratchet has advanced. The existing conversation history remains durable, but this boundary requires independent audit for crash consistency.
- Permanently malformed ciphertext remains pending until relay expiry; it does not block processing of other pending envelopes. The relay's existing envelope limits and TTL bound retained server data.
- Physical-device validation, an independent security review, and explicit dual sign-off are required before deployment under the post-RC security freeze.

## Verification

`tests/phase116-delivery-and-safe-area.test.ts` covers failed-handler retry, no ACK for a queued WebSocket duplicate, overlapping-sync deduplication, and legacy-payload classification. Relay-backed integration tests could not connect to loopback services in the sandbox.
