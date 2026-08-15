# VEIL — PHASE 15
# PRODUCTION INTEGRATION, REAL-WORLD MESSAGING & APPLICATION HARDENING

You are continuing development of the VEIL privacy-first messaging application.

IMPORTANT:
Phases 0–14 are COMPLETE.

DO NOT restart the project.
DO NOT recreate existing subsystems.
DO NOT replace the architecture.
DO NOT modify frozen cryptographic primitives unless a concrete security defect is demonstrated.
DO NOT assume previous agents' claims are correct without inspecting the actual repository.

Your job is to TAKE OVER the existing repository, inspect its actual implementation, identify integration gaps, and implement Phase 15 completely.

==================================================
1. CURRENT VERIFIED PROJECT STATE
==================================================

VEIL currently contains:

- Multi-Space cryptographic isolation
- Credential-selected Space unlocking
- Argon2id password KDF
- XChaCha20-Poly1305 AEAD
- HKDF key derivation
- EncryptedSpaceStore
- Persistent IndexedDB storage
- Schema migration framework
- Double Ratchet 1-to-1 E2EE
- Group messaging / group ratchet
- Recovery system
- Multi-device primitives
- Blind relay server
- HTTP transport
- WebSocket transport
- Offline encrypted queues
- Duplicate delivery reconciliation
- React 19 application UI
- Space switching
- Panic lock
- Auto-lock
- Safety number UI
- Groups UI
- Settings UI

Phase 14 ended with:

276 tests
117 test files
0 failures
0 skipped

Production build succeeds.

Phase 14 commit:
579d1bb

Treat this as the current baseline, but VERIFY it from the repository rather than blindly trusting this summary.

==================================================
2. FIRST TASK — TAKEOVER AUDIT
==================================================

Before writing code:

1. Read:
   - AGENTS.md
   - README.md
   - docs/ARCHITECTURE.md
   - docs/THREAT_MODEL.md
   - docs/CRYPTOGRAPHY.md
   - docs/KEY_HIERARCHY.md
   - docs/SPACE_MODEL.md
   - docs/IDENTITY_MODEL.md
   - docs/METADATA_MODEL.md
   - docs/PRIVACY.md
   - docs/SECURITY.md
   - docs/KNOWN_LIMITATIONS.md
   - docs/STORAGE_ARCHITECTURE.md
   - docs/RELAY_PROTOCOL.md
   - docs/RELAY_ARCHITECTURE.md
   - docs/NETWORK_ARCHITECTURE.md
   - docs/UI_ARCHITECTURE.md

2. Read all AI continuity files:
   - docs/ai/PROJECT_CONTEXT.md
   - docs/ai/CURRENT_STATE.md
   - docs/ai/ACTIVE_TASK.md
   - docs/ai/HANDOFF.md
   - docs/ai/DECISIONS.md
   - docs/ai/SECURITY_RULES.md
   - docs/ai/CHANGELOG.md

3. Inspect the actual source tree.

4. Run:
   npm test
   npm run build

5. Record the ACTUAL baseline.

6. Search for:
   - TODO
   - FIXME
   - mock
   - stub
   - placeholder
   - simulator
   - fake
   - hardcoded
   - console.log
   - unsafe any
   - unimplemented methods

7. Determine which Phase 14 components are genuine implementations and which are merely UI-level simulations.

Do not report success merely because a test exists.
Trace important operations into the real implementation.

==================================================
3. PHASE 15 OBJECTIVE
==================================================

Transform VEIL from:

"An end-to-end technically integrated prototype"

into:

"A genuinely usable multi-user messaging application whose major flows work against a real deployed relay."

Phase 15 focuses on:

A. Real user/contact onboarding
B. Real peer discovery / invitation flow
C. Real messaging lifecycle
D. Real group lifecycle
E. Real attachment pipeline
F. Real multi-device lifecycle
G. Real notification/event architecture
H. Error/recovery UX
I. Production configuration
J. End-to-end integration testing

==================================================
4. CONTACT & PEER ONBOARDING
==================================================

Implement a complete user-friendly contact system.

Create/extend:

src/contacts/

Possible components:

- Contact model
- Contact repository
- Contact invitation
- Identity document exchange
- Contact status
- Verification status
- Block/remove contact
- Safety number persistence
- Pending invitation state

A user must be able to:

1. Open New Chat.
2. Enter/import a VEIL identity/invitation.
3. Validate the identity document.
4. Display human-readable contact information.
5. Verify safety number.
6. Accept or reject contact.
7. Establish the actual E2EE session.
8. Persist the contact.
9. Resume the conversation after application restart.

Do NOT introduce centralized plaintext identity storage.

Contacts must remain associated with their Space.

A contact in Space A must not automatically exist in Space B.

==================================================
5. REAL INVITATION SYSTEM
==================================================

Implement a secure invitation mechanism.

The invitation must contain only what is required for onboarding.

Design it so that:

- No password is embedded.
- No private key is embedded.
- No Space master key is embedded.
- No plaintext message history is embedded.
- Invitation payloads can be authenticated.
- Expiration is supported.
- Replay can be detected.
- Malformed invitations fail safely.

Support:

- Copy invitation
- QR representation
- Import invitation
- Expired invitation
- Invalid invitation
- Already-used invitation

Do not invent custom cryptography.

Use existing identity/signature primitives.

==================================================
6. REAL MESSAGE LIFECYCLE
==================================================

Audit the entire path:

Composer
→ ConversationManager
→ Double Ratchet
→ encrypted envelope
→ NetworkManager
→ outbound queue
→ relay
→ recipient
→ inbound queue
→ persistence
→ decryption
→ conversation timeline
→ ACK

Every transition must have correct state handling.

Implement robust states:

DRAFT
QUEUED
SENDING
SENT_TO_RELAY
DELIVERED
READ
FAILED

Where READ semantics are supported by the existing architecture.

Do not falsely display "delivered" when the relay only accepted an envelope.

The UI must distinguish:

- queued locally
- accepted by relay
- delivered to recipient
- read by recipient

If a state cannot cryptographically or architecturally be proven, do not claim it.

==================================================
7. MESSAGE PERSISTENCE
==================================================

Ensure conversations survive:

- browser refresh
- application restart
- offline mode
- reconnect
- temporary relay outage
- duplicate envelope delivery
- out-of-order delivery

Implement:

- message IDs
- deterministic duplicate suppression
- ordering metadata
- failed-message retry
- retry limits
- dead-letter/error state
- safe rehydration

Never store plaintext private keys or passwords.

Message bodies may only exist decrypted in memory while the relevant Space session is unlocked.

When Space switches or locks:

- clear decrypted message caches
- clear conversation previews
- clear active decrypted attachments
- clear transient search indexes
- clear temporary cryptographic material

==================================================
8. GROUP MESSAGING HARDENING
==================================================

Audit GroupManager against the actual UI.

Implement complete flows:

- create group
- invite member
- accept invitation
- member joins
- member leaves
- member removed
- admin change
- group name change
- group metadata update
- epoch rotation
- message encryption after rotation
- stale member rejection

Verify that removed members cannot decrypt messages encrypted after their removal.

Verify forward secrecy / post-compromise expectations according to the existing group design.

Do not claim stronger guarantees than the implementation provides.

==================================================
9. ATTACHMENT PIPELINE
==================================================

Phase 14 contains attachment UI.

Now verify whether attachment encryption is genuinely integrated.

Implement a complete encrypted attachment pipeline:

FILE
→ chunk
→ encrypt
→ persist encrypted chunks
→ transmit encrypted chunks
→ receive
→ persist
→ decrypt only on demand
→ temporary Blob
→ display/download

Requirements:

- configurable chunk size
- authenticated encryption
- integrity verification
- resumable transfer
- duplicate chunk detection
- failed chunk retry
- cancellation
- progress reporting
- cleanup after failure
- cleanup after temporary use

Never send plaintext attachments to the relay.

The relay must remain blind to attachment contents.

Do not create a second encryption implementation if an existing media encryption subsystem already exists.

Reuse existing primitives.

==================================================
10. MULTI-DEVICE REAL IMPLEMENTATION
==================================================

Audit the Phase 6/14 device system.

Implement a complete real device-link flow:

Device A:
Generate pairing request
↓
Display QR / pairing payload
↓
Device B scans/imports
↓
Mutual authentication
↓
SAS comparison
↓
User confirms
↓
Secure device provisioning
↓
Device registry update
↓
Synchronization begins

Implement:

- device naming
- device list
- active/inactive status
- last seen
- revoke device
- revoked device rejection
- pairing expiration
- replay protection

A revoked device must not silently regain access.

Do not transfer raw master keys unnecessarily.

Use the existing recovery/device architecture.

==================================================
11. OFFLINE-FIRST UX
==================================================

Improve the UI for real network conditions.

The user must clearly understand:

ONLINE
CONNECTING
OFFLINE
RECONNECTING
RELAY_UNAVAILABLE

But avoid revealing unnecessary network metadata.

Implement:

- automatic retry
- exponential backoff
- manual retry
- queued message indicator
- failed message indicator
- attachment retry
- reconnect synchronization

The application must remain usable while offline.

Do not discard encrypted queued messages merely because the relay is unavailable.

==================================================
12. NOTIFICATION ARCHITECTURE
==================================================

Create a privacy-preserving notification abstraction.

Example:

src/notifications/

Support:

- notification event
- notification policy
- notification dispatcher
- browser notification adapter

Notification privacy modes:

HIDDEN
SENDER_ONLY
FULL_OBFUSCATED

Never expose message plaintext in logs.

Never put sensitive message contents into URLs.

Do not store plaintext notification history.

Respect locked Space state.

If the browser cannot safely provide a notification feature, fail gracefully.

==================================================
13. SEARCH
==================================================

Implement privacy-aware local search.

Search should operate only against data available to the currently unlocked Space.

Requirements:

- no global cross-Space search
- locked Spaces are not searchable
- encrypted persistence
- memory cleanup on lock
- no plaintext search index in localStorage
- no server-side message search

If a plaintext in-memory search index is used:

destroy it when:
- Space locks
- Space switches
- panic lock activates

Clearly document the tradeoff.

==================================================
14. ERROR & RECOVERY UX
==================================================

Create a consistent error handling layer.

Users should receive understandable errors for:

- wrong password
- corrupted Space
- relay unavailable
- network timeout
- invalid invitation
- expired invitation
- revoked device
- corrupted message
- attachment failure
- storage unavailable
- quota exceeded
- protocol mismatch

Never display:

- cryptographic secrets
- raw exception dumps
- private keys
- passwords
- decrypted ciphertext
- sensitive internal state

Security-sensitive errors should not unnecessarily reveal whether a specific secret exists.

==================================================
15. PRODUCTION CONFIGURATION
==================================================

Create a production configuration system.

Separate:

Development
Test
Production

Configuration must support:

- relay URL
- WebSocket URL
- TLS enforcement
- request timeout
- queue limits
- attachment limits
- retry limits
- notification behavior
- logging level

Never hardcode production secrets.

Never place secrets into Vite client environment variables.

Document which configuration is public and which is secret.

==================================================
16. RELAY PRODUCTION ADAPTER
==================================================

Phase 12 currently has a MemoryRelayStore.

Do NOT assume this is suitable for production.

Design a persistent relay storage abstraction.

Create:

src/server/storage/

Potential implementation:

PersistentRelayStore

Requirements:

- bounded mailbox queues
- TTL expiration
- atomic enqueue
- atomic fetch/ack
- crash recovery
- concurrent client safety
- graceful shutdown
- no plaintext E2EE decryption
- no private message storage

The relay stores only opaque encrypted envelopes and required transport metadata.

If a production database is introduced, document why.

Prefer free/open-source/self-hostable technology.

Do NOT introduce a paid cloud dependency.

==================================================
17. DATABASE ARCHITECTURE
==================================================

This is IMPORTANT.

VEIL has two fundamentally different storage environments.

CLIENT:
IndexedDB
- encrypted local application data
- Space envelopes
- encrypted message records
- encrypted queues
- local metadata

RELAY:
server-side persistence
- opaque mailbox records
- TTL metadata
- capability hashes
- delivery metadata
- no plaintext message content

Do not merge these databases.

Do not create a centralized database containing user plaintext.

Document:

docs/DATABASE_ARCHITECTURE.md

Include:

- client storage
- relay storage
- schemas
- indexes
- retention
- deletion
- migration strategy
- encryption boundaries
- trust boundaries

==================================================
18. OBSERVABILITY WITHOUT SURVEILLANCE
==================================================

Implement privacy-safe operational metrics.

Server may measure:

- request counts
- endpoint latency
- queue sizes
- active WebSocket connections
- error classes
- storage failures

Do NOT collect:

- message contents
- decrypted identities
- conversation relationships
- plaintext attachment names unless explicitly justified
- private keys
- passwords

Avoid persistent IP logging unless operationally required.

Document retention.

==================================================
19. REAL END-TO-END TEST ENVIRONMENT
==================================================

Build an automated test harness representing:

Alice
Bob
Charlie
Relay

Test:

Alice creates Space
Bob creates Space
Alice obtains Bob invitation
Alice verifies Bob
Alice establishes E2EE session
Alice sends message
Relay receives opaque envelope
Bob receives envelope
Bob decrypts
Bob ACKs
Bob replies
Alice decrypts

Then test:

OFFLINE
RECONNECT
DUPLICATE
OUT-OF-ORDER
RESTART
LOCK
SPACE SWITCH
PANIC LOCK
DEVICE REVOCATION
GROUP MEMBER REMOVAL
ATTACHMENT TRANSFER

These must be actual integration tests, not mocked UI assertions.

==================================================
20. SECURITY REGRESSION TESTS
==================================================

Add adversarial tests for:

- cross-Space message leakage
- cross-Space contacts
- cross-Space attachments
- revoked device messages
- stale group member decryption
- replayed invitations
- replayed envelopes
- duplicate messages
- corrupted attachments
- corrupted message ciphertext
- relay manipulation
- malformed WebSocket frames
- malformed HTTP requests
- oversized attachments
- queue exhaustion
- storage corruption
- restart during write
- lock during network activity
- panic lock during attachment decryption

==================================================
21. UI/UX REQUIREMENTS
==================================================

The UI must remain SIMPLE.

VEIL should NOT copy Telegram's complexity.

Primary navigation should make sense to a first-time user.

Prioritize:

1. Chats
2. Groups
3. Contacts
4. Settings

Advanced privacy/security features should be discoverable but not overwhelming.

The first screen should clearly communicate:

"Unlock your Space"

without exposing unnecessary technical terminology.

Avoid cryptography jargon unless the user explicitly opens security details.

Use progressive disclosure.

For example:

Normal:
"Verified"

Advanced:
"Compare safety number"

Do not redesign the entire UI from scratch.
Improve the existing Phase 14 UI.

==================================================
22. ACCESSIBILITY
==================================================

Add:

- keyboard navigation
- visible focus states
- semantic buttons
- ARIA labels where needed
- screen-reader-friendly status messages
- sufficient contrast
- reduced-motion support
- mobile responsive behavior

Security actions such as Panic Lock must remain immediately accessible.

==================================================
23. DOCUMENTATION
==================================================

Create/update:

docs/CONTACT_ARCHITECTURE.md
docs/INVITATION_PROTOCOL.md
docs/MESSAGE_LIFECYCLE.md
docs/ATTACHMENT_ARCHITECTURE.md
docs/DEVICE_LINKING.md
docs/DATABASE_ARCHITECTURE.md
docs/NOTIFICATION_PRIVACY.md
docs/PRODUCTION_CONFIGURATION.md
docs/PRODUCTION_DEPLOYMENT.md

Update:

docs/ai/DECISIONS.md
docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/CHANGELOG.md
docs/ai/HANDOFF.md

Every significant architectural choice gets an ADR.

==================================================
24. DEPENDENCY RULES
==================================================

Before installing a package:

1. Check whether existing dependencies already solve the problem.
2. Prefer maintained open-source packages.
3. Avoid unnecessary dependencies.
4. Avoid paid services.
5. Avoid analytics SDKs.
6. Avoid telemetry SDKs.
7. Avoid closed-source security-critical dependencies.

Do not replace cryptographic libraries simply because another package is easier.

==================================================
25. FREE DEVELOPMENT REQUIREMENT
==================================================

The entire Phase 15 development workflow must remain free.

Do not require:

- paid API
- paid database
- paid hosting
- paid authentication provider
- paid analytics
- paid cloud storage

Everything must be runnable locally.

If a production deployment requires infrastructure, document free/self-hostable options.

==================================================
26. TEST REQUIREMENTS
==================================================

Add comprehensive tests.

Expected categories:

tests/contact-*.test.ts
tests/invitation-*.test.ts
tests/message-lifecycle-*.test.ts
tests/group-production-*.test.ts
tests/attachment-*.test.ts
tests/device-production-*.test.ts
tests/notification-*.test.ts
tests/search-privacy-*.test.ts
tests/production-config-*.test.ts
tests/relay-persistence-*.test.ts
tests/e2e-realistic-*.test.ts
tests/accessibility-*.test.ts

All existing tests must continue passing.

Never weaken an existing security test simply to make the new implementation pass.

==================================================
27. DEFINITION OF DONE
==================================================

Phase 15 is COMPLETE only when:

[ ] Existing architecture was audited before modification.
[ ] All existing tests pass.
[ ] Production build passes.
[ ] Contact onboarding works.
[ ] Invitation lifecycle works.
[ ] Real 1-to-1 message lifecycle works.
[ ] Offline/reconnect behavior works.
[ ] Message persistence survives restart.
[ ] Group lifecycle is fully integrated.
[ ] Removed members cannot decrypt future group messages.
[ ] Attachment encryption is genuinely end-to-end.
[ ] Multi-device linking works.
[ ] Device revocation works.
[ ] Notifications respect privacy settings.
[ ] Local search respects Space isolation.
[ ] Production configuration exists.
[ ] Relay persistence exists or is explicitly justified if deferred.
[ ] Client and relay database boundaries are documented.
[ ] No plaintext secrets are persisted.
[ ] No plaintext messages are sent to the relay.
[ ] No secrets appear in logs.
[ ] Adversarial tests pass.
[ ] Accessibility checks pass.
[ ] All documentation is updated.
[ ] AI continuity files are updated.
[ ] Git working tree is clean.
[ ] A Phase 15 commit is created.

==================================================
28. SECURITY NON-NEGOTIABLES
==================================================

NEVER:

- log passwords
- log private keys
- log master keys
- persist plaintext messages
- send plaintext messages to relay
- send plaintext attachments to relay
- put secrets in URLs
- put secrets in localStorage
- invent cryptographic primitives
- silently downgrade TLS
- silently bypass authentication
- weaken authentication to simplify UI
- allow cross-Space access
- allow revoked devices to reconnect
- allow removed group members to decrypt future messages

If a security invariant conflicts with convenience:

SECURITY WINS.

==================================================
29. FINAL VERIFICATION
==================================================

Run:

npm test
npm run build

Then perform a full local deployment test:

1. Start relay.
2. Start client.
3. Create Alice Space.
4. Create Bob Space.
5. Establish contact.
6. Verify safety number.
7. Send messages both directions.
8. Disconnect network.
9. Send messages offline.
10. Reconnect.
11. Verify delivery.
12. Restart both clients.
13. Verify persistence.
14. Create group.
15. Add/remove members.
16. Send group messages.
17. Transfer encrypted attachment.
18. Link second device.
19. Revoke device.
20. Trigger Panic Lock.
21. Verify all sensitive state disappears from active memory/UI state as far as the runtime permits.
22. Inspect browser storage.
23. Inspect relay storage.
24. Confirm no plaintext messages, passwords, or private keys exist.
25. Run full test suite again.

==================================================
30. HANDOFF REQUIREMENT
==================================================

At completion, update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md

The final handoff MUST contain:

- actual implementation completed
- files created
- files modified
- actual test count
- actual build result
- actual integration test result
- known limitations
- deferred work
- security findings
- commit hash
- working-tree status

DO NOT CLAIM SOMETHING IS IMPLEMENTED IF IT IS ONLY MOCKED.

If something cannot safely be implemented in Phase 15:

1. document why,
2. leave the existing secure behavior intact,
3. add a test where possible,
4. record it as a limitation,
5. do not fake the feature.

==================================================
FINAL INSTRUCTION
==================================================

You are not being asked to merely create scaffolding.

You are being asked to take the existing VEIL implementation and make the major application flows genuinely operational.

Inspect first.
Reuse existing architecture.
Implement incrementally.
Test continuously.
Preserve security boundaries.
Do not rewrite working cryptographic systems.

At the end, Phase 15 must leave VEIL in a materially more usable and production-ready state than Phase 14.