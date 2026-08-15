You are continuing development of the VEIL secure messaging application.

IMPORTANT:
You are taking over an existing repository.

DO NOT assume the repository is empty.
DO NOT recreate existing architecture.
DO NOT rewrite completed phases.
DO NOT replace existing cryptographic implementations.

Your first responsibility is to inspect the repository and establish
ground truth before modifying anything.

============================================================
PROJECT STATUS
============================================================

VEIL has completed Phases 0–11.

Phase 11 is COMPLETE.

Phase 11 commit:

4f2ff15

Commit message:

feat(storage): implement Phase 11 persistent IndexedDB storage adapter,
schema migrations, and restart persistence integration

Phase 11 verification:

- 94/94 test files passed
- 236/236 tests passed
- npm run build passed
- IndexedDB persistence verified across fresh instances
- cross-space isolation verified
- locked-space access rejection verified
- ciphertext tampering verified
- fail-closed storage behavior verified
- working tree clean

The repository currently contains:

PHASES 0–10:
- cryptographic primitives
- key hierarchy
- multi-space vault
- identities
- privacy architecture
- transport primitives
- Double Ratchet
- groups
- encrypted media primitives
- multi-device
- recovery
- metadata/privacy mechanisms
- security tests
- adversarial tests

PHASE 11:
- IStorageAdapter
- IndexedDBStorageAdapter
- MemoryStorageAdapter
- migration framework
- persistent Space envelopes
- persistent encrypted records
- restart persistence
- storage security tests

============================================================
PHASE 12 OBJECTIVE
============================================================

Build the first real VEIL network backend:

A standalone, privacy-preserving relay server and formally defined
client ↔ relay transport protocol.

The relay is NOT a trusted party.

The relay must function as a blind transport/storage intermediary.

The relay must NEVER need access to:

- passwords
- SpaceMasterKeys
- StorageKeys
- private identity keys
- message plaintext
- media plaintext
- group plaintext
- conversation plaintext

The relay should primarily know:

- an opaque mailbox/capability identifier
- an opaque encrypted envelope
- minimal operational metadata required for delivery and expiry

The relay must NOT become a central identity database.

============================================================
CRITICAL ARCHITECTURAL PRINCIPLE
============================================================

VEIL encryption happens BEFORE data reaches the relay.

The intended architecture is:

Sender
  |
  | plaintext
  v
VEIL client
  |
  | E2EE encryption
  v
opaque encrypted envelope
  |
  v
Relay
  |
  | stores/forwards opaque envelope
  v
Recipient
  |
  | decrypts locally
  v
plaintext

The relay MUST NOT decrypt or inspect message contents.

The relay is transport infrastructure, not a trusted cryptographic
endpoint.

============================================================
FROZEN COMPONENTS
============================================================

The following components are STRICTLY FROZEN unless a minimal,
backward-compatible interface adjustment is absolutely necessary:

src/crypto/
src/spaces/
src/ratchet/
src/group/
src/recovery/

Do NOT:

- redesign cryptography
- replace Argon2id
- replace XChaCha20-Poly1305
- replace HKDF
- redesign Double Ratchet
- redesign group epochs
- redesign recovery
- introduce server-side encryption keys
- create a second identity system

If integration requires a change to a frozen component:

STOP and document the compatibility issue before making a
cryptographic modification.

============================================================
PHASE 12 SCOPE
============================================================

PHASE 12 INCLUDES:

1. Relay protocol specification
2. Standalone relay server
3. HTTP control/data endpoints
4. WebSocket delivery channel
5. Blind mailbox/capability model
6. Opaque encrypted envelope handling
7. Envelope validation
8. TTL/expiration
9. Acknowledgement/deletion
10. Resource limits
11. Rate limiting
12. Backpressure
13. Connection lifecycle
14. Privacy-preserving operational logging
15. Server configuration
16. Graceful shutdown
17. Error handling
18. Automated server tests
19. Protocol tests
20. Adversarial tests
21. Documentation
22. AI continuity updates

============================================================
PHASE 12 DOES NOT INCLUDE
============================================================

DO NOT implement:

- React UI
- ChatView
- Sidebar
- message composer
- contact UI
- group UI
- media UI
- settings UI
- device UI
- recovery UI
- complete client networking integration
- actual user registration system
- centralized account database
- usernames
- email registration
- phone-number registration
- server-side message decryption
- server-side searchable messages
- message content indexing

Those belong to later phases.

The relay server must be usable independently of the UI.

============================================================
STEP 0 — TAKEOVER AUDIT
============================================================

Before writing code:

1. Inspect repository structure.
2. Read:

   AGENTS.md
   README.md
   docs/ARCHITECTURE.md
   docs/THREAT_MODEL.md
   docs/METADATA_MODEL.md
   docs/PRIVACY.md
   docs/SECURITY.md
   docs/KNOWN_LIMITATIONS.md
   docs/STORAGE_ARCHITECTURE.md

3. Read:

   docs/ai/PROJECT_CONTEXT.md
   docs/ai/CURRENT_STATE.md
   docs/ai/ACTIVE_TASK.md
   docs/ai/HANDOFF.md
   docs/ai/DECISIONS.md

4. Inspect existing transport-related code.

5. Inspect existing tests.

6. Confirm Phase 11 is actually present.

7. Run the existing test suite BEFORE modification.

Record the baseline.

DO NOT proceed if the repository is already failing for unrelated
reasons without documenting the failure.

============================================================
1. DEFINE THE RELAY PROTOCOL
============================================================

Create:

docs/RELAY_PROTOCOL.md

Define a versioned protocol.

Example conceptual version:

VEIL Relay Protocol v1

The protocol must define:

- request formats
- response formats
- envelope structure
- mailbox identifiers
- capability tokens
- TTL
- acknowledgement
- errors
- size limits
- WebSocket messages
- protocol version negotiation
- server limits

Do not invent unnecessary fields.

Every field must have a privacy/security reason.

============================================================
2. BLIND MAILBOX MODEL
============================================================

The relay must support opaque mailboxes.

A mailbox is NOT:

- a username
- an email
- a phone number
- a human-readable account ID

Instead, use cryptographically random opaque identifiers/capabilities.

The server must not require a central identity record for basic relay
operation.

Design the mailbox lifecycle:

create
  ↓
obtain capability
  ↓
send encrypted envelopes
  ↓
recipient fetches envelopes
  ↓
acknowledge
  ↓
envelope deleted

The server must not be able to derive a user's identity from the
mailbox identifier alone.

============================================================
3. CAPABILITY AUTHENTICATION
============================================================

Implement capability-based authorization.

A client possessing the appropriate secret capability may perform
operations on its mailbox.

The capability must NOT be logged.

Never store capability secrets in plaintext server logs.

Avoid unnecessarily storing reusable secrets.

If the architecture allows secure one-way verification, prefer that
over plaintext secret storage.

Document the chosen design and threat model.

============================================================
4. ENVELOPE MODEL
============================================================

Define a relay envelope containing only information necessary for
transport.

Conceptually:

RelayEnvelope {

  protocolVersion

  envelopeId

  mailboxId

  createdAt

  expiresAt

  payload

}

Where:

payload = opaque ciphertext generated by the VEIL client.

The server MUST treat payload as opaque bytes.

The server must not attempt to parse:

- plaintext message
- sender
- recipient identity
- group name
- Space name
- media filename
- message text

unless a field is strictly required by the relay protocol itself.

============================================================
5. ENVELOPE SIZE LIMITS
============================================================

Implement strict maximum envelope sizes.

Reject:

- oversized payloads
- malformed envelopes
- missing required fields
- invalid protocol versions
- invalid identifiers
- invalid timestamps
- expired envelopes where appropriate

Use bounded parsing.

Never allocate unbounded memory based on client-controlled sizes.

Define limits centrally in configuration.

============================================================
6. TTL / EXPIRATION
============================================================

Every relay envelope must have an expiration policy.

The relay must:

- reject invalid expiration times
- prevent envelopes from living indefinitely
- periodically delete expired envelopes
- delete acknowledged envelopes
- prevent expired envelopes from being delivered

Implement bounded garbage collection.

Do not rely solely on client cleanup.

The server must enforce TTL.

============================================================
7. HTTP API
============================================================

Implement the relay HTTP API.

Suggested endpoints:

GET /healthz

GET /readyz

POST /v1/mailboxes

POST /v1/envelopes

POST /v1/envelopes/fetch

POST /v1/envelopes/ack

The exact names may be adjusted if repository architecture suggests
a better convention.

Each endpoint must have:

- strict request validation
- bounded body size
- controlled error responses
- authentication/capability validation where required
- no sensitive information in errors
- no payload logging

Do NOT return internal exception details to clients.

============================================================
8. WEBSOCKET DELIVERY
============================================================

Implement a WebSocket transport for near-real-time envelope delivery.

Conceptually:

Client
  |
  | authenticate mailbox capability
  v
WebSocket
  |
  | relay watches mailbox
  v
new opaque envelope
  |
  v
client

The WebSocket server must NOT decrypt the payload.

Implement:

- connection authentication
- mailbox subscription
- heartbeat/ping
- disconnect handling
- reconnect-safe behavior
- bounded connections
- bounded outbound queues
- backpressure
- graceful shutdown

Do not assume clients remain connected forever.

============================================================
9. DELIVERY SEMANTICS
============================================================

Define explicit delivery semantics.

The relay should use:

AT-LEAST-ONCE DELIVERY

rather than pretending exactly-once delivery exists.

Example:

Envelope stored
    ↓
recipient receives
    ↓
recipient processes
    ↓
recipient acknowledges
    ↓
relay deletes

If the connection dies before acknowledgement:

Envelope remains available.

The protocol must make duplicate delivery safe.

The server must NOT attempt to determine whether the recipient has
actually decrypted the message.

============================================================
10. ACKNOWLEDGEMENT
============================================================

Implement acknowledgement using envelope identifiers.

An ACK should only succeed when authorized for the corresponding
mailbox.

Do not allow one mailbox capability to acknowledge another mailbox's
envelopes.

Test:

Mailbox A cannot ACK Mailbox B's envelope.

============================================================
11. REPLAY / DUPLICATE HANDLING
============================================================

Define what happens when:

- same envelope is submitted twice
- same envelope ID is reused
- ACK is repeated
- fetch is repeated
- WebSocket reconnects
- network request is retried

Do not rely on the server to provide message-level cryptographic
replay protection.

The server should provide transport-level consistency only.

Existing E2EE protocols remain responsible for cryptographic
message authenticity/replay semantics.

============================================================
12. RATE LIMITING
============================================================

Implement privacy-conscious rate limiting.

Rate limits should protect against:

- mailbox flooding
- oversized request abuse
- connection exhaustion
- CPU exhaustion
- storage exhaustion
- request storms

Do NOT create a permanent centralized behavioral profile of users.

Prefer short-lived operational counters.

Document:

- what is counted
- retention period
- scope
- privacy tradeoff

============================================================
13. RESOURCE LIMITS
============================================================

Implement hard bounds for:

- maximum envelope size
- maximum mailbox queue size
- maximum envelopes per mailbox
- maximum WebSocket connections
- maximum request body size
- maximum concurrent requests
- maximum TTL
- cleanup batch size

The server must remain bounded under malicious input.

============================================================
14. SERVER STORAGE
============================================================

Implement a server-side storage abstraction.

Do NOT directly couple relay logic to one storage implementation.

Create an abstraction such as:

IRelayStore

with operations conceptually equivalent to:

createMailbox()
storeEnvelope()
getEnvelope()
listPendingEnvelopes()
ackEnvelope()
deleteExpired()
close()

The storage layer must support transactional behavior where needed.

For Phase 12, a local development implementation is acceptable.

Do NOT prematurely build a distributed database architecture.

============================================================
15. SERVER DATA MINIMIZATION
============================================================

The server should store only what it needs.

At minimum:

- opaque mailbox identifier
- envelope identifier
- opaque encrypted payload
- creation/expiration information
- minimal delivery state

Avoid storing:

- usernames
- email addresses
- phone numbers
- message plaintext
- sender names
- recipient names
- conversation titles
- group names
- Space names
- contact lists

============================================================
16. SERVER LOGGING
============================================================

Implement structured logging.

Logs MUST NOT contain:

- passwords
- capabilities
- private keys
- SMKs
- decrypted plaintext
- complete encrypted payloads
- authentication secrets

Be extremely cautious with:

- IP addresses
- mailbox IDs
- envelope IDs
- timestamps
- request correlation IDs

If operational logging requires them, minimize retention and document
the metadata implications.

Provide configurable log levels.

Production default should avoid sensitive debug output.

============================================================
17. ERROR MODEL
============================================================

Define safe protocol errors.

Example categories:

BAD_REQUEST
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
TOO_LARGE
RATE_LIMITED
EXPIRED
CONFLICT
STORAGE_UNAVAILABLE
INTERNAL_ERROR

Do not expose stack traces.

Do not expose database errors.

Do not reveal whether unrelated mailbox identifiers exist unless
protocol semantics require it.

============================================================
18. CONFIGURATION
============================================================

Create centralized server configuration.

Configuration should cover:

- port
- host
- maximum envelope size
- mailbox TTL
- maximum queue size
- rate limits
- WebSocket limits
- cleanup interval
- log level

Do not hardcode production deployment assumptions throughout the
codebase.

Development defaults are acceptable.

Secrets must come from environment/configuration rather than source.

============================================================
19. GRACEFUL SHUTDOWN
============================================================

Implement graceful shutdown.

On SIGINT/SIGTERM:

1. stop accepting new requests
2. stop new WebSocket connections
3. allow bounded in-flight work to finish
4. close storage
5. close WebSocket connections
6. release resources
7. exit cleanly

Do not corrupt stored envelopes.

============================================================
20. SECURITY TESTING
============================================================

Create comprehensive Phase 12 tests.

Suggested:

tests/relay-protocol.test.ts

tests/relay-server.test.ts

tests/relay-capabilities.test.ts

tests/relay-delivery.test.ts

tests/relay-websocket.test.ts

tests/relay-abuse.test.ts

tests/relay-privacy.test.ts

tests/relay-shutdown.test.ts

============================================================
21. REQUIRED ADVERSARIAL TESTS
============================================================

Test:

- malformed JSON
- malformed binary payload
- oversized payload
- missing capability
- invalid capability
- wrong mailbox capability
- mailbox A accessing mailbox B
- mailbox A ACKing mailbox B
- expired envelope
- future-dated envelope
- invalid TTL
- duplicate envelope
- duplicate ACK
- repeated fetch
- WebSocket reconnect
- connection flooding
- mailbox flooding
- queue exhaustion
- rate-limit exhaustion
- storage failure
- cleanup failure
- graceful shutdown
- corrupted persisted relay record

============================================================
22. PRIVACY TESTS
============================================================

Add tests ensuring logs do not contain:

- capability secrets
- passwords
- plaintext
- private keys
- SMKs
- full encrypted payloads

Add tests verifying that relay processing does not invoke any
cryptographic decryption of client message payloads.

The relay should be capable of handling an encrypted envelope without
knowing what is inside it.

============================================================
23. INTEGRATION TEST
============================================================

Create a complete end-to-end RELAY-ONLY integration test.

Use two simulated clients:

CLIENT A
CLIENT B

Flow:

A creates/obtains mailbox capability
B creates/obtains mailbox capability

A submits an opaque encrypted test envelope to B's mailbox.

Relay stores it.

B fetches it.

B receives the exact opaque payload.

B ACKs it.

Relay removes it.

Then verify:

- A's payload was never decrypted by relay
- B received the exact bytes
- ACK removes the envelope
- repeated fetch does not return acknowledged envelope

IMPORTANT:

This is a transport integration test.

Do NOT implement the complete user-facing messaging system yet.

============================================================
24. SERVER TEST CRYPTOGRAPHY BOUNDARY
============================================================

The relay may use cryptography for:

- generating random mailbox identifiers
- capability verification
- secure internal tokens where necessary

But it MUST NOT implement message encryption/decryption.

Do not add:

encryptMessage()
decryptMessage()

to the relay.

Message encryption belongs to the client.

============================================================
25. DOCUMENTATION
============================================================

Create:

docs/RELAY_ARCHITECTURE.md
docs/RELAY_PROTOCOL.md
docs/RELAY_SECURITY.md
docs/RELAY_PRIVACY.md

Document:

- trust boundaries
- data flow
- API
- WebSocket protocol
- capability model
- delivery semantics
- TTL
- resource limits
- logging
- threat model
- known limitations

Explicitly state:

"The relay is not trusted with message plaintext."

============================================================
26. AI CONTINUITY
============================================================

Update:

docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/CHANGELOG.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md

Add architecture decisions for:

- relay protocol
- capability mailbox model
- at-least-once delivery
- TTL
- server resource limits
- privacy-preserving logging

Do not overwrite historical decisions.

Append new ADRs sequentially after the latest existing ADR.

============================================================
27. TEST & BUILD VERIFICATION
============================================================

Before implementation:

npm test

After implementation:

npm test

npm run build

All existing Phase 0–11 tests MUST remain passing.

No existing security tests may be deleted or weakened.

Expected outcome:

100% existing tests pass
+
all Phase 12 tests pass

============================================================
28. CODE QUALITY REQUIREMENTS
============================================================

Use strict TypeScript.

Avoid:

- any unless unavoidable
- unsafe casts
- duplicated protocol logic
- duplicated validation
- unbounded buffers
- silent errors
- hidden fallback behavior
- sensitive logging
- global mutable state where unnecessary

Centralize:

- limits
- protocol versions
- error codes
- validation
- configuration

============================================================
29. PRODUCTION SECURITY BOUNDARY
============================================================

The Phase 12 server is NOT yet considered production-ready merely
because tests pass.

Document explicitly:

- TLS termination/deployment requirement
- reverse proxy considerations
- DDoS limitations
- operating-system security
- server filesystem security
- database/storage security
- IP metadata limitations
- traffic analysis limitations
- administrator trust limitations
- availability limitations

Do not claim anonymity guarantees that the architecture cannot prove.

============================================================
30. DEFINITION OF DONE
============================================================

Phase 12 is COMPLETE only when:

[ ] Relay protocol is documented
[ ] Relay server exists
[ ] HTTP API works
[ ] WebSocket delivery works
[ ] blind mailbox model works
[ ] capability authorization works
[ ] mailbox isolation works
[ ] envelope validation works
[ ] TTL enforcement works
[ ] ACK/deletion works
[ ] at-least-once delivery is implemented
[ ] duplicate handling is defined
[ ] resource limits exist
[ ] rate limiting exists
[ ] backpressure exists
[ ] graceful shutdown works
[ ] server storage abstraction exists
[ ] sensitive logging is prevented
[ ] adversarial tests pass
[ ] privacy tests pass
[ ] integration test passes
[ ] Phase 0–11 tests still pass
[ ] npm run build passes
[ ] documentation is complete
[ ] AI continuity files are updated
[ ] no UI has been implemented
[ ] no client networking integration has been implemented
[ ] no frozen cryptographic core has been redesigned
[ ] no centralized user-account system has been introduced
[ ] Git commit created
[ ] working tree clean

============================================================
FINAL AGENT BEHAVIOR
============================================================

When implementation is complete:

1. Run all tests.
2. Run production build.
3. Inspect git diff.
4. Check for secrets and sensitive logging.
5. Verify no Phase 13/UI work was accidentally introduced.
6. Verify frozen cryptographic directories were not improperly modified.
7. Create one atomic Phase 12 commit.
8. Update AI continuity documentation.
9. Report exact:
   - files created
   - files modified
   - tests passed
   - build result
   - commit hash
   - working tree status
   - known limitations
10. STOP.

Do NOT begin Phase 13 automatically.

The next phase will be:

PHASE 13 — CLIENT NETWORKING & RELAY INTEGRATION

END OF PHASE 12 PROMPT