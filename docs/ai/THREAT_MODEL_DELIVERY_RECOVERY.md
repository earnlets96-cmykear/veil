# Threat Model: Delivery Recovery

## Existing inbound delivery review

### Scope

This review covers the client-side inbox lifecycle in `NetworkManager`, `EnvelopeQueue`, and the AppState inbound handler. The relay protocol, mailbox authorization, ciphertext format, ratchet, and cryptographic primitives are unchanged.

### Assets and trust boundaries

- The relay stores opaque ciphertext and is untrusted for message confidentiality or integrity.
- The client persists inbound ciphertext and processed envelope IDs inside the active Space's encrypted store.
- The active Space's existing Double Ratchet and conversation history remain the authority for authenticating and storing message content.

### Failure and abuse cases

1. **Processing failure followed by premature relay ACK**: the server deletes the only copy while the local queue stays unprocessed. Mitigation: do not ACK pending rows; retry them during mailbox sync and re-entry.
2. **Concurrent sync/WebSocket delivery**: two handlers could process the same ratchet envelope concurrently. Mitigation: serialize processing by envelope ID in the active NetworkManager instance and re-check the encrypted processed-ID registry.
3. **Undecryptable payload reported as handled**: a swallowed decryption error could cause an ACK. Mitigation: only use the existing legacy JSON fallback when the payload matches its supported message shape; otherwise propagate the error and leave it pending.
4. **Replay or duplicate relay delivery**: a processed message could be shown twice. Mitigation: the existing processed-ID registry suppresses replay and permits safe ACK of already-processed envelopes.

### Residual risks and release gates

- The delivery callback and encrypted queue are separate persistence operations; a process crash between them can cause a retry after the ratchet has advanced. The existing conversation history remains durable, but this boundary requires independent audit for crash consistency.
- Permanently malformed ciphertext remains pending until relay expiry; it does not block processing of other pending envelopes. The relay's existing envelope limits and TTL bound retained server data.
- Physical-device validation, an independent security review, and explicit dual sign-off are required before deployment under the post-RC security freeze.

### Verification

`tests/phase116-delivery-and-safe-area.test.ts` covers failed-handler retry, no ACK for a queued WebSocket duplicate, overlapping-sync deduplication, and legacy-payload classification. Relay-backed integration tests could not connect to loopback services in the sandbox.

## Identity-bound outbound route recovery review

### Scope

This review covers client-side retry of encrypted envelopes when the relay rejects an expired recipient mailbox, refresh of cached peer profile/routing fields, and authentication of contact request/response control messages. It does not change the message wire format, encryption, ratchet state, identity keys, or relay storage.

### Assets and assumptions

- Contact identity-to-signing-key bindings stored in each encrypted Space.
- End-to-end encrypted message and media payloads in the outbound queue.
- Contact relationship state (pending, accepted, declined).
- Public profile data, including mailbox route and avatar.
- The relay and directory are untrusted for message content and must not replace an established contact identity.
- A refreshed signed profile is accepted only when its identity and signing key match the locally stored contact/request.
- If the directory is unavailable, stale, malicious, or returns a different identity, route refresh fails closed and the ciphertext remains queued.

### Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| A dead mailbox strands an accepted request or encrypted message | Resolve the current mailbox by stable identity after a relay 404/expired response; retry the unchanged encrypted payload; preserve the queue on failure. |
| Directory response substitutes a different signing identity | Require a valid signed profile, exact identity ID, and equality with the known signing key before changing route or profile fields. |
| Forged contact request is stored as incoming | Verify the request signature and reject before persisting relationship state. |
| Forged acceptance/decline changes local relationship state | Verify response signature, match the pending request ID and peer identity, and reject responses for non-pending requests. |
| Acceptance substitutes a different key under a reused identity ID | Verify the responder profile using the signing key pinned in the pending request; verify the nested identity document and its identity ID before changing contact state. |
| A request signature is replayed to another recipient | Require the signed request payload to include this recipient's identity ID and sent timestamp; reject the legacy fallback that omitted both fields. |
| Network/directory outage causes loss | Keep the outbound item queued and retry on a later mailbox sync; do not log plaintext or credentials. |

### Residual risks and release gates

- Directory/relay outages can delay delivery; this client cannot deliver while the recipient has no current mailbox or the directory is unreachable.
- This change does not guarantee recipient-side decryption if the peer's ratchet/prekey state is already out of sync. That needs a separate protocol investigation and its security governance.
- The initial independent review identified responder-key substitution and recipient-unbound legacy request-signature acceptance; the implementation now rejects both and has adversarial regressions. Follow-up review is pending.
- Physical-device validation remains outstanding. Relay-backed Phase 37/67 integration passed with local relay access.
- Before deployment, complete follow-up independent review, formal security audit, and explicit dual sign-off under the post-RC security freeze.
