You are continuing development of the VEIL secure messaging application.

IMPORTANT:
You are taking over an EXISTING repository.

Do NOT assume the repository is empty.
Do NOT recreate existing architecture.
Do NOT rewrite completed phases.
Do NOT replace existing cryptographic implementations.
Do NOT build the React UI in this phase.

Your first responsibility is to inspect the repository and establish
ground truth before modifying anything.

============================================================
PROJECT STATUS
============================================================

VEIL has completed Phases 0–12.

LATEST VERIFIED PHASE:

Phase 12 — Production Relay Protocol & Standalone Relay Server

Commit:

51c2a3f

Phase 12 verification:

- 102/102 test files passed
- 256/256 tests passed
- 0 failures
- 0 skipped
- npm run build passed
- working tree clean

Phase 12 delivered:

- Relay Protocol v1
- blind mailbox model
- capability authorization
- opaque envelope transport
- HTTP relay API
- WebSocket delivery
- TTL enforcement
- acknowledgement/deletion
- at-least-once delivery
- rate limiting
- resource limits
- backpressure
- graceful shutdown
- relay storage abstraction
- privacy-preserving logging
- adversarial relay tests
- end-to-end simulated relay transport

Phase 11 delivered:

- IStorageAdapter
- IndexedDBStorageAdapter
- MemoryStorageAdapter
- schema migrations
- persistent encrypted Space envelopes
- persistent encrypted application records
- restart persistence
- cross-space isolation
- storage tampering detection

Phases 0–10 delivered:

- cryptographic primitives
- key hierarchy
- multi-space architecture
- independent Space identities
- privacy transport primitives
- Double Ratchet
- groups
- encrypted media primitives
- multi-device/recovery
- privacy/security mechanisms
- adversarial testing

============================================================
PHASE 13 OBJECTIVE
============================================================

Connect the existing VEIL client-side messaging engine to the
Phase 12 relay server.

After Phase 13, VEIL must be capable of:

CLIENT
  ↓
encrypt message using existing E2EE machinery
  ↓
produce opaque transport envelope
  ↓
send through Phase 12 relay
  ↓
recipient receives opaque envelope
  ↓
client processes/decrypts locally
  ↓
message becomes available to the application

The relay MUST remain blind.

The relay must never receive:

- message plaintext
- Space passwords
- SpaceMasterKeys
- StorageKeys
- private identity keys
- Double Ratchet state
- group plaintext
- media plaintext

============================================================
MOST IMPORTANT ARCHITECTURAL RULE
============================================================

PHASE 13 IS AN INTEGRATION PHASE.

Do NOT redesign:

- cryptography
- Space architecture
- Double Ratchet
- groups
- recovery
- relay protocol

Integrate the existing systems.

If existing interfaces are insufficient, create thin adapters rather
than rewriting the underlying subsystem.

============================================================
FROZEN COMPONENTS
============================================================

Treat these as cryptographically frozen:

src/crypto/
src/spaces/
src/ratchet/
src/group/
src/recovery/

Phase 12 relay implementation should also be treated as protocol
frozen.

Do not modify relay semantics simply to make client integration
easier.

If a compatibility problem exists:

1. document it
2. determine whether an adapter can solve it
3. prefer the adapter
4. only modify an existing interface if absolutely necessary
5. never silently alter a security invariant

============================================================
STEP 0 — TAKEOVER AUDIT
============================================================

Before writing code:

Read:

AGENTS.md
README.md

docs/ARCHITECTURE.md
docs/THREAT_MODEL.md
docs/CRYPTOGRAPHY.md
docs/KEY_HIERARCHY.md
docs/SPACE_MODEL.md
docs/IDENTITY_MODEL.md
docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/SECURITY.md
docs/KNOWN_LIMITATIONS.md
docs/STORAGE_ARCHITECTURE.md

Read Phase 12 documentation:

docs/RELAY_PROTOCOL.md
docs/RELAY_ARCHITECTURE.md
docs/RELAY_SECURITY.md
docs/RELAY_PRIVACY.md

Read AI continuity:

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/CHANGELOG.md

Inspect:

src/crypto/
src/spaces/
src/ratchet/
src/group/
src/recovery/
src/storage/
src/server/

Inspect all existing transport-related code.

Run:

npm test

Run:

npm run build

Record the baseline.

Do not delete or weaken existing tests.

============================================================
1. CLIENT NETWORKING ARCHITECTURE
============================================================

Create a client-side networking subsystem.

Suggested location:

src/network/

Potential structure:

src/network/types.ts
src/network/errors.ts
src/network/config.ts
src/network/relayClient.ts
src/network/httpTransport.ts
src/network/websocketTransport.ts
src/network/mailboxClient.ts
src/network/envelopeQueue.ts
src/network/reconnect.ts
src/network/networkManager.ts
src/network/index.ts

The exact structure may be adjusted to fit the repository.

Keep responsibilities separated.

============================================================
2. RELAY CLIENT
============================================================

Implement:

RelayClient

Responsibilities:

- connect to relay
- create/register mailbox
- send envelopes
- fetch envelopes
- acknowledge envelopes
- establish WebSocket connection
- close connections
- expose connection state
- handle protocol errors

The RelayClient must understand Phase 12 Relay Protocol v1.

Do NOT duplicate relay protocol definitions unnecessarily.

Where possible, share or derive types from the existing protocol
definitions.

============================================================
3. MAILBOX MANAGEMENT
============================================================

Implement client-side mailbox lifecycle.

A VEIL Space should be able to associate itself with a relay mailbox.

Conceptually:

Space
  |
  +-- local identity
  |
  +-- local keys
  |
  +-- relay mailbox capability

The mailbox capability is sensitive.

NEVER store it:

- in plaintext logs
- in URLs
- in error messages
- in normal application telemetry
- in unencrypted IndexedDB records

The capability must be protected using the existing Space encryption
/storage mechanisms.

Do not create a global mailbox shared by all Spaces.

============================================================
4. SPACE ↔ MAILBOX ISOLATION
============================================================

This is CRITICAL.

Different Spaces must not accidentally share:

- mailbox capabilities
- mailbox IDs
- network queues
- ratchet state
- message stores

For example:

Personal Space
    ↓
Mailbox A

Private Space
    ↓
Mailbox B

Work Space
    ↓
Mailbox C

A compromised or unlocked Space must not automatically gain access
to another Space's mailbox.

Add explicit tests for this.

============================================================
5. OUTBOUND MESSAGE PIPELINE
============================================================

Create a clean pipeline:

Application message
        ↓
Space context
        ↓
Identity / Ratchet
        ↓
E2EE ciphertext
        ↓
Transport envelope
        ↓
RelayClient
        ↓
Relay

The network subsystem must never receive plaintext unless the
message is still inside the trusted local application boundary.

Once converted to a transport envelope, the payload must be opaque.

============================================================
6. E2EE INTEGRATION
============================================================

Integrate with the EXISTING Double Ratchet implementation.

Do not implement a second ratchet.

Do not create a second encryption system.

The network layer should transport the output of the existing
cryptographic subsystem.

The conceptual flow should be:

encryptMessage(...)
        ↓
ciphertext
        ↓
createTransportEnvelope(...)
        ↓
RelayClient.send(...)
        ↓
relay

On receipt:

RelayClient
        ↓
transport envelope
        ↓
existing message envelope parser
        ↓
existing Double Ratchet
        ↓
plaintext

The relay never participates in this process cryptographically.

============================================================
7. TRANSPORT ENVELOPE ADAPTER
============================================================

Create a thin adapter between:

existing VEIL encrypted message representation

and:

Phase 12 RelayEnvelope

Do NOT force the relay protocol to understand E2EE internals.

The relay should only see:

- mailbox
- envelope ID
- timestamps/TTL
- opaque payload

The client owns the internal message structure.

============================================================
8. OUTBOUND QUEUE
============================================================

Implement a persistent outbound queue.

Why:

A user may send a message while:

- offline
- relay temporarily unavailable
- WebSocket disconnected
- network changes
- application temporarily loses connectivity

The message must not simply disappear.

Flow:

message encrypted locally
        ↓
stored in encrypted local queue
        ↓
network available
        ↓
send
        ↓
relay accepts
        ↓
remove from outbound queue

IMPORTANT:

The queue must contain ciphertext / encrypted transport data,
not plaintext.

Use Phase 11 encrypted storage.

============================================================
9. INBOUND QUEUE
============================================================

Implement an inbound processing queue.

Flow:

relay
 ↓
opaque envelope
 ↓
local persistent pending queue
 ↓
cryptographic processing
 ↓
message storage
 ↓
ACK relay

Do not ACK an envelope before the client has safely persisted the
required encrypted message state.

The goal is:

delivery from relay
    ≠
successful application processing

The client must preserve messages if processing fails.

============================================================
10. ACK SAFETY
============================================================

Implement:

receive
 ↓
validate
 ↓
persist
 ↓
process
 ↓
commit
 ↓
ACK

Do NOT:

receive
 ↓
ACK
 ↓
try to process

Otherwise a crash could cause message loss.

Test crash/failure scenarios.

============================================================
11. AT-LEAST-ONCE DELIVERY
============================================================

Phase 12 intentionally uses at-least-once delivery.

Therefore Phase 13 must tolerate duplicates.

Possible sequence:

Envelope received
↓
client crashes
↓
ACK never reaches relay
↓
relay sends envelope again
↓
client receives duplicate

The client must detect/reconcile duplicates safely.

Do NOT assume:

"one envelope = one delivery"

Define a stable local envelope/message identifier.

Duplicate delivery must not produce duplicate user-visible messages.

============================================================
12. WEBSOCKET CONNECTION MANAGER
============================================================

Implement a robust WebSocket client.

States:

DISCONNECTED
CONNECTING
CONNECTED
AUTHENTICATING
READY
RECONNECTING
CLOSING
FAILED

Implement:

- connection establishment
- authentication
- heartbeat
- timeout detection
- disconnect detection
- automatic reconnect
- exponential backoff
- jitter
- maximum retry delay
- clean shutdown

Do not reconnect in a tight loop.

============================================================
13. RECONNECT STRATEGY
============================================================

Use bounded exponential backoff.

Example conceptual sequence:

1s
2s
4s
8s
16s
30s
30s
...

Add jitter.

Reset backoff after successful stable connection.

Do not allow network failure to cause a CPU/battery-burning loop.

============================================================
14. HTTP FALLBACK
============================================================

WebSocket is for real-time delivery.

HTTP should remain available for:

- mailbox creation
- envelope submission
- pending envelope fetch
- acknowledgement

If WebSocket disconnects:

1. maintain outbound queue
2. reconnect
3. fetch pending envelopes
4. reconcile duplicates
5. resume real-time delivery

Do not depend exclusively on WebSocket state.

============================================================
15. NETWORK STATE MACHINE
============================================================

Create a central NetworkManager.

Possible state:

type NetworkState =
  | "offline"
  | "connecting"
  | "connected"
  | "degraded"
  | "reconnecting"
  | "stopped"
  | "error"

The rest of the application should not need to understand WebSocket
internals.

Expose high-level events such as:

connected
disconnected
messageReceived
messageQueued
messageSent
messageFailed
reconnecting

============================================================
16. NETWORK FAILURE HANDLING
============================================================

Correctly handle:

- DNS failure
- connection refused
- timeout
- HTTP 4xx
- HTTP 5xx
- malformed relay response
- WebSocket close
- authentication failure
- mailbox revoked
- expired envelope
- oversized envelope
- relay unavailable
- storage unavailable
- corrupted local queue
- duplicate message
- partial network transmission

Never silently discard messages.

============================================================
17. RETRY POLICY
============================================================

Retry only operations that are safe to retry.

For message submission:

Use a stable envelope ID.

If the client does not know whether the relay accepted the message,
retrying with the same envelope ID must not create uncontrolled
duplicates.

Do not blindly retry non-idempotent operations.

Document retry semantics.

============================================================
18. OFFLINE-FIRST BEHAVIOR
============================================================

The messaging engine should be functional while offline.

When offline:

User message
   ↓
encrypt locally
   ↓
persist encrypted outbound queue
   ↓
show pending state to application
   ↓
network returns
   ↓
send automatically

The plaintext should not need to remain in memory waiting for
network connectivity.

============================================================
19. APPLICATION RESTART
============================================================

Test:

Application instance 1:

- unlock Space
- create encrypted message
- network unavailable
- persist outbound queue
- shut down

Application instance 2:

- reopen
- unlock same Space
- restore encrypted outbound queue
- connect to relay
- send pending envelope
- verify delivery

No plaintext message should be required to survive restart.

============================================================
20. MULTI-SPACE NETWORK TEST
============================================================

Create at least:

Space A
Space B

Each with:

- separate identity
- separate mailbox
- separate storage
- separate network state

Verify:

Space A cannot:

- send using Space B's capability
- fetch Space B's mailbox
- ACK Space B's envelopes
- access Space B's outbound queue
- access Space B's inbound queue

Repeat with at least 10 Spaces.

============================================================
21. NETWORK SECURITY BOUNDARY
============================================================

The network layer must NEVER log:

- passwords
- private keys
- SMKs
- StorageKeys
- mailbox capabilities
- plaintext messages
- complete ciphertext payloads

If envelope IDs are logged, ensure they do not expose sensitive
application information.

============================================================
22. TLS / TRANSPORT SECURITY
============================================================

The client must support secure relay URLs.

Production configuration must require:

https://
wss://

for remote deployments.

Plain HTTP/WS may be allowed only for explicit local development
configuration.

Do not silently downgrade HTTPS → HTTP.

Do not silently downgrade WSS → WS.

Certificate/TLS failures must fail closed.

============================================================
23. RELAY AUTHENTICATION BOUNDARY
============================================================

The client must authenticate to the relay using the Phase 12
capability protocol.

Do not introduce:

- username/password authentication
- email authentication
- phone authentication
- server-side account passwords

VEIL's relay identity is capability-based.

============================================================
24. CLIENT NETWORK STORAGE
============================================================

Use Phase 11's storage abstraction.

Potential persistent structures:

network metadata
mailbox association
outbound queue
inbound queue
delivery state
last synchronization state

Sensitive values must be encrypted before persistence.

Do not bypass:

IStorageAdapter

Do not directly access IndexedDB from the network subsystem.

============================================================
25. MESSAGE STATUS
============================================================

Create transport/application-independent delivery states.

For example:

QUEUED
SENDING
SENT_TO_RELAY
DELIVERED_TO_RECIPIENT
PROCESSING
PROCESSED
FAILED

Be careful with terminology.

"Sent to relay" does NOT mean:

"delivered to recipient."

The relay cannot know whether the recipient has decrypted the
message.

============================================================
26. TIMEOUTS
============================================================

Centralize network timeouts.

Define:

- connect timeout
- request timeout
- WebSocket handshake timeout
- heartbeat timeout
- message processing timeout
- reconnect delay

Never allow a network operation to hang forever.

============================================================
27. CLIENT-SIDE RATE CONTROL
============================================================

Prevent the client from generating uncontrolled traffic when:

- reconnecting
- flushing queues
- retrying messages
- recovering after offline periods

Implement bounded queue draining.

Do not reconnect and immediately dump thousands of requests at once.

============================================================
28. PROTOCOL VERSION COMPATIBILITY
============================================================

The client must verify relay protocol version.

If the relay reports an incompatible version:

- fail safely
- do not guess
- do not silently downgrade security-sensitive behavior

Document compatibility rules.

============================================================
29. TEST SUITE
============================================================

Create:

tests/network-relay-client.test.ts
tests/network-mailbox.test.ts
tests/network-send.test.ts
tests/network-receive.test.ts
tests/network-websocket.test.ts
tests/network-reconnect.test.ts
tests/network-offline.test.ts
tests/network-persistence.test.ts
tests/network-duplicates.test.ts
tests/network-multispace.test.ts
tests/network-security.test.ts
tests/network-integration.test.ts

Use the existing Phase 12 relay server in integration tests.

============================================================
30. REQUIRED NETWORK TESTS
============================================================

Test:

[ ] mailbox creation
[ ] capability storage
[ ] capability protection
[ ] envelope submission
[ ] envelope fetch
[ ] ACK
[ ] WebSocket connection
[ ] WebSocket authentication
[ ] WebSocket message delivery
[ ] heartbeat
[ ] disconnect
[ ] reconnect
[ ] exponential backoff
[ ] jitter
[ ] HTTP fallback
[ ] offline queue
[ ] restart recovery
[ ] duplicate delivery
[ ] duplicate envelope submission
[ ] ACK-after-persistence
[ ] malformed relay response
[ ] relay unavailable
[ ] timeout
[ ] rate limiting
[ ] queue backpressure
[ ] 10-space isolation
[ ] no plaintext logging
[ ] no key leakage
[ ] HTTPS/WSS enforcement
[ ] protocol version mismatch
[ ] graceful client shutdown

============================================================
31. FULL END-TO-END E2EE TEST
============================================================

This is the most important Phase 13 integration test.

Create:

CLIENT A
CLIENT B

Both use real existing VEIL cryptographic components.

Flow:

1. Initialize Space A.
2. Initialize Space B.
3. Establish their existing identities/session state.
4. Configure relay.
5. Give each client a mailbox.
6. Establish an appropriate existing E2EE session.
7. Client A creates message:

"Hello from VEIL"

8. Existing VEIL cryptographic layer encrypts it.
9. Network layer creates transport envelope.
10. Client A sends envelope to relay.
11. Relay stores opaque payload.
12. Client B receives envelope.
13. Client B persists it.
14. Client B processes it through existing cryptographic layer.
15. Client B obtains:

"Hello from VEIL"

16. Client B ACKs the relay envelope.
17. Relay removes the envelope.

Verify:

- message plaintext never enters relay
- relay never decrypts payload
- ciphertext survives transport unchanged
- message decrypts correctly
- duplicate delivery does not create duplicate message
- ACK occurs only after safe persistence
- both clients retain correct ratchet state

============================================================
32. RELAY BLACK-BOX TEST
============================================================

Instrument the relay test environment.

Verify the relay receives only:

- mailbox/capability transport information
- opaque envelope data

Verify the relay never receives:

- plaintext message
- Space password
- SMK
- private identity key
- Double Ratchet secret
- group secret

This test must be explicit.

============================================================
33. SECURITY REGRESSION
============================================================

Run every existing security test.

Do not modify tests merely to make them pass.

If a previous security invariant fails because of the integration,
fix the integration.

============================================================
34. DOCUMENTATION
============================================================

Create:

docs/NETWORK_ARCHITECTURE.md
docs/CLIENT_RELAY_INTEGRATION.md
docs/OFFLINE_DELIVERY.md
docs/NETWORK_SECURITY.md

Document:

- client network architecture
- relay integration
- mailbox lifecycle
- outbound pipeline
- inbound pipeline
- ACK semantics
- duplicate handling
- reconnect behavior
- offline behavior
- persistence
- Space isolation
- TLS requirements
- threat boundaries
- known limitations

Update:

README.md

with the current architecture status.

============================================================
35. AI CONTINUITY
============================================================

Update:

docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/CHANGELOG.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md

Add new ADRs sequentially after ADR-061.

Document decisions for:

- client network abstraction
- mailbox-per-Space isolation
- persistent outbound queue
- inbound ACK ordering
- duplicate handling
- WebSocket reconnect
- offline-first delivery
- TLS fail-closed behavior

Do NOT overwrite previous ADRs.

============================================================
36. BUILD VERIFICATION
============================================================

Before implementation:

npm test
npm run build

After implementation:

npm test
npm run build

ALL previous tests must continue passing.

No existing tests may be deleted.

No security assertions may be weakened.

============================================================
37. MANUAL END-TO-END VERIFICATION
============================================================

Run:

npm run dev

or the repository's equivalent development command.

Start the Phase 12 relay.

Create:

Client A
Client B

Then verify:

1. A connects to relay.
2. B connects to relay.
3. A obtains mailbox.
4. B obtains mailbox.
5. A establishes E2EE session with B.
6. A sends message.
7. B receives message.
8. B decrypts message.
9. B ACKs envelope.
10. Relay removes envelope.

Then disconnect B.

A sends another message.

Verify:

- message remains queued at relay
- B reconnects
- B receives pending message
- B processes it
- B ACKs it

Then disconnect A's network.

Send several messages.

Verify:

- messages are encrypted locally
- messages persist in outbound queue
- no plaintext survives as required
- network restoration drains queue
- no duplicate messages appear

============================================================
38. PERFORMANCE / RESOURCE TEST
============================================================

Test:

- 100 queued messages
- reconnect
- bounded queue draining
- multiple concurrent envelopes
- multiple Spaces
- repeated WebSocket reconnects

Ensure:

- no unbounded memory growth
- no infinite retry loop
- no request storm
- no event listener leak
- no duplicate WebSocket connections

============================================================
39. IMPORTANT NON-GOALS
============================================================

DO NOT build:

- React UI
- chat screens
- contact screens
- settings screens
- media UI
- group UI
- notification UI
- user registration
- usernames
- phone number authentication
- email authentication
- centralized account database

Those belong to later phases.

============================================================
40. DEFINITION OF DONE
============================================================

Phase 13 is COMPLETE only when:

[ ] Client networking subsystem exists
[ ] RelayClient implemented
[ ] mailbox lifecycle implemented
[ ] mailbox capability protected
[ ] mailbox-per-Space isolation verified
[ ] HTTP transport implemented
[ ] WebSocket transport implemented
[ ] reconnect logic implemented
[ ] heartbeat implemented
[ ] HTTP fallback implemented
[ ] outbound queue implemented
[ ] inbound queue implemented
[ ] encrypted queue persistence implemented
[ ] ACK-after-persistence implemented
[ ] duplicate handling implemented
[ ] offline operation implemented
[ ] restart recovery implemented
[ ] network state machine implemented
[ ] retry policy implemented
[ ] TLS fail-closed behavior implemented
[ ] protocol version validation implemented
[ ] resource/backpressure protections implemented
[ ] full E2EE integration test passes
[ ] relay black-box privacy test passes
[ ] multi-Space isolation tests pass
[ ] adversarial network tests pass
[ ] all Phase 0–12 tests pass
[ ] npm run build passes
[ ] documentation complete
[ ] AI continuity updated
[ ] no UI accidentally implemented
[ ] frozen cryptographic core preserved
[ ] Phase 12 relay protocol preserved
[ ] Git commit created
[ ] working tree clean

============================================================
FINAL REPORT
============================================================

When finished:

1. Run npm test.
2. Run npm run build.
3. Inspect git diff.
4. Inspect git status.
5. Check for secrets.
6. Check for plaintext logging.
7. Verify no cryptographic core was unnecessarily changed.
8. Verify no Phase 14/UI work was introduced.
9. Create ONE atomic Phase 13 commit.
10. Update all AI continuity files.
11. Report:

- exact files created
- exact files modified
- baseline test count
- final test count
- build result
- E2EE integration result
- offline/restart result
- multi-Space isolation result
- commit hash
- working tree status
- known limitations

Then STOP.

DO NOT automatically begin Phase 14.

============================================================
NEXT PHASE
============================================================

PHASE 14 will be the first major APPLICATION/UI phase.

It will build the actual user-facing VEIL experience on top of the
now-working:

Crypto
+
Spaces
+
Storage
+
Relay
+
Client Networking

Do not implement Phase 14 during this task.

END OF PHASE 13 PROMPT